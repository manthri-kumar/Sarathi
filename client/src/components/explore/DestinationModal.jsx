// src/components/explore/DestinationModal.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useExploreSearchContext } from "../../pages/ExploreSearchContext";
import { loadGoogleMaps, toSelectedCity } from "../../lib/loadGoogleMaps";
import PopularDestinations from "./PopularDestinations";
import TrendingDestinations from "./TrendingDestinations";
import RecentSearches from "./RecentSearches";
import "./DestinationModal.css";

const REGION = ["in"]; // change/remove to widen beyond India
const DEBOUNCE_MS = 300;

const LOCALITY_PRIORITY = [
  "locality",
  "sublocality_level_1",
  "sublocality",
  "administrative_area_level_2",
  "administrative_area_level_1",
];

function cityFromComponents(components = [], fallback = "Your Location") {
  const list = Array.isArray(components) ? components : [];
  for (const type of LOCALITY_PRIORITY) {
    const match = list.find((c) =>
      (c.types || c.Types || []).includes(type)
    );
    if (match) return match.long_name || match.longText || fallback;
  }
  return fallback;
}

const DestinationModal = ({ onClose }) => {
  const { t } = useTranslation();
  const { chooseDestination } = useExploreSearchContext();

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const placesLibRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const reqIdRef = useRef(0);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  /* SDK bootstrap */
  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then(async (google) => {
        const [places] = await Promise.all([
          google.maps.importLibrary("places"),
          google.maps.importLibrary("geocoding"),
        ]);
        if (!alive) return;
        placesLibRef.current = places;
        geocoderRef.current = new google.maps.Geocoder();
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      })
      .catch(
        () =>
          alive &&
          setError(t("mapsLoadError") || "Search is unavailable right now.")
      );
    return () => {
      alive = false;
    };
  }, [t]);

  /* body scroll lock + ESC */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  /* finalize a selection */
  const select = useCallback(
    (entry) => {
      chooseDestination(entry);
      onClose();
    },
    [chooseDestination, onClose]
  );

  /* autocomplete — new Places API */
  const runSearch = useCallback(
    async (input) => {
      const places = placesLibRef.current;
      if (!places || !input.trim()) {
        setPredictions([]);
        setSearching(false);
        return;
      }
      const myReq = ++reqIdRef.current;
      setSearching(true);
      setError("");

      try {
        const { suggestions } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: REGION,
          });
        if (myReq !== reqIdRef.current) return;
        const mapped = (suggestions || [])
          .filter((s) => s.placePrediction)
          .map((s) => {
            const p = s.placePrediction;
            return {
              id: p.placeId,
              main: p.mainText?.text || p.text?.text || "",
              secondary: p.secondaryText?.text || "",
              prediction: p,
            };
          });
        setPredictions(mapped);
      } catch {
        if (myReq === reqIdRef.current) {
          setPredictions([]);
          setError(t("searchError") || "Could not fetch results.");
        }
      } finally {
        if (myReq === reqIdRef.current) setSearching(false);
      }
    },
    [t]
  );

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(v), DEBOUNCE_MS);
  };

  /* prediction → {city,lat,lng} */
  const pickPrediction = useCallback(
    async (item) => {
      if (resolving) return;
      setResolving(true);
      setError("");
      try {
        const place = item.prediction.toPlace();
        await place.fetchFields({
          fields: ["location", "displayName", "addressComponents"],
        });
        const lat = place.location.lat();
        const lng = place.location.lng();
        const label =
          item.main ||
          place.displayName ||
          cityFromComponents(place.addressComponents, item.main);
        sessionTokenRef.current =
          new placesLibRef.current.AutocompleteSessionToken();
        select(toSelectedCity(label, lat, lng));
      } catch {
        setError(t("resolveError") || "Could not load that destination.");
      } finally {
        setResolving(false);
      }
    },
    [resolving, select, t]
  );

  /* popular / trending → geocode by name */
  const pickByName = useCallback(
    (name) => {
      const geocoder = geocoderRef.current;
      if (!geocoder || resolving) return;
      setResolving(true);
      setError("");
      geocoder.geocode(
        { address: name, componentRestrictions: { country: REGION[0] } },
        (results, status) => {
          setResolving(false);
          if (status === "OK" && results?.[0]) {
            const loc = results[0].geometry.location;
            select(toSelectedCity(name, loc.lat(), loc.lng()));
          } else {
            setError(t("resolveError") || "Could not load that destination.");
          }
        }
      );
    },
    [resolving, select, t]
  );

  /* detect my location */
  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setError(t("geoUnsupported") || "Geolocation is not supported.");
      return;
    }
    setDetecting(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geocoder = geocoderRef.current;
        if (!geocoder) {
          setDetecting(false);
          return;
        }
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setDetecting(false);
          const components = results?.[0]?.address_components || [];
          const label = cityFromComponents(components);
          if (status === "OK") {
            select(toSelectedCity(label, lat, lng));
          } else {
            select(toSelectedCity("Your Location", lat, lng));
          }
        });
      },
      () => {
        setDetecting(false);
        setError(t("geoDenied") || "Location permission was denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [select, t]);

  /* recent → already carries coords */
  const pickRecent = useCallback((entry) => select(entry), [select]);

  const list = Array.isArray(predictions) ? predictions : [];

  return createPortal(
    <div
      className="dest-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("chooseDestination") || "Choose a destination"}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dest-modal">
        <header className="dest-modal__head">
          <h2 className="dest-modal__title">
            {t("whereTo") || "Where would you like to go?"}
          </h2>
          <button
            type="button"
            className="dest-modal__close"
            onClick={onClose}
            aria-label={t("close") || "Close"}
          >
            ✕
          </button>
        </header>

        {/* A. SEARCH */}
        <div className="dest-search">
          <span className="dest-search__icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            className="dest-search__input"
            value={query}
            onChange={onChange}
            disabled={!ready}
            placeholder={
              t("searchPlaceholder") ||
              "Search cities, destinations, temples, tourist places..."
            }
            autoComplete="off"
          />
          {(searching || resolving) && <span className="dest-search__spin" />}
        </div>

        {error && <p className="dest-modal__error">{error}</p>}

        {/* PREDICTIONS */}
        {query.trim() && (
          <ul className="dest-predictions">
            {!searching && list.length === 0 && (
              <li className="dest-predictions__empty">
                {t("noResults") || "No matches found."}
              </li>
            )}
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="dest-predictions__row"
                  onClick={() => pickPrediction(p)}
                  disabled={resolving}
                >
                  <span className="dest-predictions__pin" aria-hidden="true">📍</span>
                  <span className="dest-predictions__text">
                    <strong>{p.main}</strong>
                    {p.secondary && <small>{p.secondary}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* B. DETECT + sections */}
        {!query.trim() && (
          <>
            <button
              type="button"
              className="dest-detect"
              onClick={detect}
              disabled={detecting || !ready}
            >
              <span className="dest-detect__icon" aria-hidden="true">🧭</span>
              <span className="dest-detect__text">
                <strong>{t("detectLocation") || "Detect my location"}</strong>
                <small>
                  {detecting
                    ? t("detecting") || "Detecting…"
                    : t("useGps") || "Use current GPS position"}
                </small>
              </span>
            </button>

            <RecentSearches onSelect={pickRecent} />
            <PopularDestinations onSelect={pickByName} disabled={resolving} />
            <TrendingDestinations onSelect={pickByName} disabled={resolving} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default DestinationModal;