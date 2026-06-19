// src/lib/loadGoogleMaps.js
// Loads the Google Maps JS API once (singleton). The new Places API is pulled
// on demand via google.maps.importLibrary — not via the URL libraries param.
// Vite users: swap process.env.REACT_APP_* for import.meta.env.VITE_*.

let loaderPromise = null;

export function loadGoogleMaps() {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve(window.google);

    const key = process.env.REACT_APP_GOOGLE_MAPS_KEY;
    if (!key) return reject(new Error("Missing REACT_APP_GOOGLE_MAPS_KEY"));

    const existing = document.getElementById("gmaps-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load"))
      );
      return;
    }

    const s = document.createElement("script");
    s.id = "gmaps-sdk";
    s.async = true;
    s.defer = true;
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&v=weekly&loading=async`;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });

  return loaderPromise;
}

// Normalizes any source to the Explore contract consumed by Explore.jsx.
export function toSelectedCity(label, lat, lng) {
  return { city: label, lat, lng };
}