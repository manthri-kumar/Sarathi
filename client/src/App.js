import "./i18n";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthPage from "./components/Auth/AuthPage";

import Dashboard from "./pages/Dashboard";
import Explore from "./pages/Explore";
import Itinerary from "./pages/Itinerary";
import MyTrips from "./pages/MyTrips";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import DayPlanner from "./pages/DayPlanner";
import TripPlanner from "./pages/TripPlanner";
import TempleExplorer from "./pages/TempleExplorer";

import TempleDetailsPage from "./components/temple/TempleDetailsPage";

import { ExploreSearchProvider } from "./pages/ExploreSearchContext";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const isOAuthCallback =
    window.location.hash.includes("access_token");

  if (token && !isOAuthCallback) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <ExploreSearchProvider>
      <BrowserRouter>
        <Routes>

          {/* Auth */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Explore */}
          
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <Explore />
              </ProtectedRoute>
            }
          />

          {/* Itinerary */}
          <Route
            path="/itinerary"
            element={
              <ProtectedRoute>
                <Itinerary />
              </ProtectedRoute>
            }
          />

          {/* Saved */}
          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <Saved />
              </ProtectedRoute>
            }
          />

          {/* Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Day Planner */}
          <Route
            path="/day-planner"
            element={
              <ProtectedRoute>
                <DayPlanner />
              </ProtectedRoute>
            }
          />

          {/* Trip Planner */}
          <Route
            path="/trip-planner"
            element={
              <ProtectedRoute>
                <TripPlanner />
              </ProtectedRoute>
            }
          />

          {/* My Trips */}
          <Route
            path="/my-trips"
            element={
              <ProtectedRoute>
                <MyTrips />
              </ProtectedRoute>
            }
          />

          {/* Temple Explorer */}
          <Route
            path="/temples"
            element={
              <ProtectedRoute>
                <TempleExplorer />
              </ProtectedRoute>
            }
          />

          {/* Temple Details */}
          <Route
            path="/temples/:placeId"
            element={
              <ProtectedRoute>
                <TempleDetailsPage />
              </ProtectedRoute>
            }
          />

        </Routes>
      </BrowserRouter>
    </ExploreSearchProvider>
  );
}

export default App;
