// client/src/context/ExploreSearchContext.jsx
import React, { createContext, useContext } from "react";
import { useExploreSearch } from "../hooks/useExploreSearch";

const ExploreSearchContext = createContext(null);

export function ExploreSearchProvider({ children }) {
  const value = useExploreSearch();
  return (
    <ExploreSearchContext.Provider value={value}>
      {children}
    </ExploreSearchContext.Provider>
  );
}

export function useExploreSearchContext() {
  const ctx = useContext(ExploreSearchContext);
  if (!ctx) {
    throw new Error(
      "useExploreSearchContext must be used within <ExploreSearchProvider>"
    );
  }
  return ctx;
}

export default ExploreSearchContext;