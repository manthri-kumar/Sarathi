// client/src/hooks/useExploreSearch.js

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

        // Backend returns array directly
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
  ================================== */

  const resolveAndSelect = useCallback(async (rawText) => {
    const q = String(rawText || "").trim();

    if (!q) return;

    setResolving(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/geocode/location?q=${encodeURIComponent(q)}`
      );

      if (res.status === 404) {
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
      console.error("Location Error:", err);
      setError("Search failed. Try again.");
    } finally {
      setResolving(false);
    }
  }, []);

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