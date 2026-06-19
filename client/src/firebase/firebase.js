// client/src/firebase/firebase.js
// ---------------------------------------------------------------------------
// Sarathi — Firestore as realtime datastore over an EXISTING backend JWT auth.
//
// We do NOT migrate to Firebase Auth, add popups, or touch AuthPage.
// To make Firestore security rules enforceable (request.auth.uid), the client
// silently exchanges the existing backend JWT for a Firebase *custom token*
// at REACT_APP_FIREBASE_TOKEN_ENDPOINT and calls signInWithCustomToken.
//
// Backend contract (one endpoint you already control, no UI change):
//   POST {REACT_APP_FIREBASE_TOKEN_ENDPOINT}
//   Authorization: Bearer <existing JWT>
//   -> 200 { "firebaseToken": "<custom token minted via Admin SDK>" }
//   The custom token's uid MUST equal the userId used for Firestore scoping.
//
// If the endpoint is absent/unreachable, Firestore still works for reads/writes
// ONLY IF your rules are in permissive/dev mode. For production, expose the
// endpoint so the strict rules in firestore.rules apply. Identity used for
// query scoping always comes from the JWT, independent of this bridge.
// ---------------------------------------------------------------------------

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persistent, multi-tab cache: instant cold opens + offline resilience.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);

const TOKEN_KEY = "token";
const USER_KEY = "user";
const FIREBASE_TOKEN_ENDPOINT = process.env.REACT_APP_FIREBASE_TOKEN_ENDPOINT;

// --- Existing JWT / user accessors (localStorage is the source of truth) ----

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Decode JWT payload WITHOUT verifying (verification stays on the backend).
// Used only to recover a canonical user id when the user object lacks one.
function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Canonical user id for Firestore scoping. Order: explicit user fields, then
// common JWT identity claims. This is the value every query is scoped against.
export function getCurrentUserId() {
  const user = getCurrentUser();
  const fromUser =
    user?.uid || user?.id || user?._id || user?.userId || user?.sub || null;
  if (fromUser) return String(fromUser);

  const token = getAuthToken();
  const payload = token ? decodeJwtPayload(token) : null;
  const fromJwt =
    payload?.uid || payload?.id || payload?._id || payload?.userId || payload?.sub;
  return fromJwt ? String(fromJwt) : null;
}

// --- Silent Firebase auth bridge (custom token), idempotent & non-blocking --

let bridgePromise = null;

export function ensureFirebaseAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (bridgePromise) return bridgePromise;

  const jwt = getAuthToken();
  if (!jwt || !FIREBASE_TOKEN_ENDPOINT) {
    // No bridge available: identity scoping still works; strict rules require it.
    return Promise.resolve(null);
  }

  bridgePromise = fetch(FIREBASE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
      return res.json();
    })
    .then(({ firebaseToken }) => {
      if (!firebaseToken) throw new Error("no firebaseToken in response");
      return signInWithCustomToken(auth, firebaseToken);
    })
    .then((cred) => cred.user)
    .catch((err) => {
      // Degrade gracefully — never block the dropdowns on the bridge.
      // eslint-disable-next-line no-console
      console.warn("[firebase] auth bridge unavailable:", err.message);
      return null;
    })
    .finally(() => {
      bridgePromise = null;
    });

  return bridgePromise;
}

// Resolve once auth is settled (bridged or anonymous-less), so the first
// onSnapshot fires under a known auth state.
export function waitForAuthReady() {
  return new Promise((resolve) => {
    ensureFirebaseAuth().finally(() => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve(u);
      });
    });
  });
}

export default app;