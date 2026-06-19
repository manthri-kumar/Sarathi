import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";
const DEBOUNCE_MS = 500;

export function useExploreSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  // Selected city
  const [selectedCity, setSelectedCity] = useState(null);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  /* ==================================
     CITY SUGGESTIONS
  ================================== */

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const q = query.trim();

    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch(
          `${API_BASE}/api/geocode/suggest?q=${encodeURIComponent(q)}`,
          {
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          throw new Error(`Suggest Error ${res.status}`);
        }

        const data = await res.json();

        // Backend returns array with {placeId, description}
        setSuggestions(Array.isArray(data) ? data : []);

        setError(null);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Suggestion Error:", err);
          setSuggestions([]);
          setError("Could not load suggestions");
        }
      } finally {
        setSuggestLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  /* ==================================
     RESOLVE CITY -> LAT LNG
     
     PRODUCTION FIX:
     - Accepts description text from UI
     - Finds matching placeId from suggestions array
     - Calls /place-details endpoint with placeId
     - Uses GOOGLE_PLACES_KEY (already working)
     - Avoids REQUEST_DENIED from Geocoding API
     
     No UI changes needed - hook handles placeId extraction
  ================================== */

  const resolveAndSelect = useCallback(async (rawText) => {
    const q = String(rawText || "").trim();

    if (!q) return;

    // Find matching suggestion with placeId
    const matchingSuggestion = suggestions.find(
      (s) => s.description === q
    );

    if (!matchingSuggestion || !matchingSuggestion.placeId) {
      setError("Invalid selection. Please select from the suggestions.");
      return;
    }

    const placeId = matchingSuggestion.placeId;

    setResolving(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/geocode/place-details?placeId=${encodeURIComponent(
          placeId
        )}`
      );

      if (res.status === 400) {
        setError("Location not found");
        return;
      }

      if (!res.ok) {
        throw new Error(`Location Error ${res.status}`);
      }

      const data = await res.json();

      setSelectedCity({
        city: data.city,
        lat: data.lat,
        lng: data.lng,
      });

      setQuery(data.city);
      setSuggestions([]);
    } catch (err) {
      console.error("Location Resolution Error:", err);
      setError("Search failed. Try again.");
    } finally {
      setResolving(false);
    }
  }, [suggestions]);

  /* ==================================
     CLEAR
  ================================== */

  const clearSearch = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,

    suggestions,
    suggestLoading,

    resolving,
    error,

    selectedCity,

    resolveAndSelect,
    clearSearch,
  };
}

export default useExploreSearch;
