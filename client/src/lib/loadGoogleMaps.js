// src/lib/loadGoogleMaps.js

let loaderPromise = null;

export function loadGoogleMaps() {
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    try {
      // Already loaded
      if (window.google?.maps) {
        return resolve(window.google);
      }

      const key = process.env.REACT_APP_GOOGLE_MAPS_KEY;

      console.log(
        "Google Maps Key:",
        key ? `${key.substring(0, 8)}...` : "NOT FOUND"
      );

      if (!key) {
        console.error("REACT_APP_GOOGLE_MAPS_KEY is missing");
        return reject(
          new Error("Missing REACT_APP_GOOGLE_MAPS_KEY")
        );
      }

      // Script already exists
      const existingScript = document.getElementById("gmaps-sdk");

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.google?.maps) {
            resolve(window.google);
          } else {
            reject(
              new Error(
                "Google Maps loaded but window.google.maps is unavailable"
              )
            );
          }
        });

        existingScript.addEventListener("error", () => {
          reject(new Error("Google Maps script failed"));
        });

        return;
      }

      const script = document.createElement("script");

      script.id = "gmaps-sdk";
      script.async = true;
      script.defer = true;

      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${key}` +
        `&libraries=places` +
        `&v=weekly`;

      script.onload = () => {
        if (!window.google?.maps) {
          reject(
            new Error(
              "Google Maps API loaded but maps object unavailable"
            )
          );
          return;
        }

        console.log("Google Maps loaded successfully");
        resolve(window.google);
      };

      script.onerror = () => {
        console.error("Failed to load Google Maps");
        reject(new Error("Failed to load Google Maps"));
      };

      document.head.appendChild(script);
    } catch (err) {
      console.error("Google Maps Loader Error:", err);
      reject(err);
    }
  });

  return loaderPromise;
}

export function toSelectedCity(label, lat, lng) {
  return {
    city: label,
    lat,
    lng,
  };
}git add .
git commit -m "fix google maps loader"
git push origin main