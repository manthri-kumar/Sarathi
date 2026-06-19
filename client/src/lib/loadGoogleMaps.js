// src/lib/loadGoogleMaps.js
let loaderPromise = null;

export function loadGoogleMaps() {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve(window.google);

    const key = process.env.REACT_APP_GOOGLE_MAPS_KEY;
    if (!key) return reject(new Error("Missing REACT_APP_GOOGLE_MAPS_KEY"));

    const finish = () =>
      window.google?.maps?.importLibrary
        ? resolve(window.google)
        : reject(new Error("Maps loaded but importLibrary is unavailable"));

    const existing = document.getElementById("gmaps-sdk");
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script failed"))
      );
      return;
    }

    const s = document.createElement("script");
    s.id = "gmaps-sdk";
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&loading=async`;
    s.onload = finish;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });

  return loaderPromise;
}

export function toSelectedCity(label, lat, lng) {
  return { city: label, lat, lng };
}