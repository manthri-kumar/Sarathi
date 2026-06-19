// src/pages/ExploreSearchContext.jsx
// Keep at this path so Explore.jsx's `./ExploreSearchContext` import is unchanged.
// If your existing provider exposed extra fields, merge them into `value` below.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

const ExploreSearchContext = createContext(null);

const RECENT_KEY = "sarathi.recentSearches";
const RECENT_LIMIT = 5;

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const ExploreSearchProvider = ({ children }) => {
  // Consumed by Explore.jsx — shape MUST stay { city, lat, lng }.
  const [selectedCity, setSelectedCity] = useState(null);
  const [recentSearches, setRecentSearches] = useState(readRecent);

  const addRecentSearch = useCallback((entry) => {
    if (!entry?.city || entry.lat == null || entry.lng == null) return;
    setRecentSearches((prev) => {
      const deduped = prev.filter(
        (r) => r.city.toLowerCase() !== entry.city.toLowerCase()
      );
      const next = [{ ...entry }, ...deduped].slice(0, RECENT_LIMIT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage disabled — non-fatal */
      }
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // Single entry point used by the picker: persist + select in one call.
  const chooseDestination = useCallback(
    (entry) => {
      if (!entry?.city || entry.lat == null || entry.lng == null) return;
      addRecentSearch(entry);
      setSelectedCity({ city: entry.city, lat: entry.lat, lng: entry.lng });
    },
    [addRecentSearch]
  );

  const value = useMemo(
    () => ({
      selectedCity,
      setSelectedCity,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      chooseDestination,
    }),
    [
      selectedCity,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      chooseDestination,
    ]
  );

  return (
    <ExploreSearchContext.Provider value={value}>
      {children}
    </ExploreSearchContext.Provider>
  );
};

export const useExploreSearchContext = () => {
  const ctx = useContext(ExploreSearchContext);
  if (!ctx) {
    throw new Error(
      "useExploreSearchContext must be used within <ExploreSearchProvider>"
    );
  }
  return ctx;
};
