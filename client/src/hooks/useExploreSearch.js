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
  // { city, lat, lng } once a city is chosen; Explore reacts to this.
  const [selectedCity, setSelectedCity] = useState(null);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced suggestions.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return undefined;
    }

    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `${API_BASE}/api/search/suggest?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`suggest ${res.status}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setError(null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load suggestions");
          setSuggestions([]);
        }
      } finally {
        setSuggestLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Resolve a city name / prediction to coordinates and select it.
  const resolveAndSelect = useCallback(async (rawText) => {
    const q = (rawText ?? "").toString().trim();
    if (!q) return;
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/search/location?q=${encodeURIComponent(q)}`
      );
      if (res.status === 404) {
        setError("Location not found");
        return;
      }
      if (!res.ok) throw new Error(`location ${res.status}`);
      const data = await res.json();
      setSelectedCity({ city: data.city || q, lat: data.lat, lng: data.lng });
      setQuery(data.city || q);
      setSuggestions([]);
    } catch (err) {
      setError("Search failed. Try again.");
    } finally {
      setResolving(false);
    }
  }, []);

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