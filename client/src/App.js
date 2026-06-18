import "./i18n";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/Auth/AuthPage";
import Dashboard from "./pages/Dashboard";
import Itinerary from "./pages/Itinerary";
import Explore from "./pages/Explore";
import MyTrips from "./pages/MyTrips";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import DayPlanner from "./pages/DayPlanner";
import TripPlanner from "./pages/TripPlanner";
import TempleExplorer from "./pages/TempleExplorer";
import TempleDetailsPage from "./components/temple/TempleDetailsPage"; // ✅ ADD THIS

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" />;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const isOAuthCallback = window.location.hash.includes("access_token");
  if (token && !isOAuthCallback) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<PublicRoute><AuthPage /></PublicRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/explore"   element={<ProtectedRoute><Explore /></ProtectedRoute>} />
        <Route path="/itinerary" element={<ProtectedRoute><Itinerary /></ProtectedRoute>} />
        <Route path="/saved"     element={<ProtectedRoute><Saved /></ProtectedRoute>} />
        <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/day-planner"  element={<ProtectedRoute><DayPlanner /></ProtectedRoute>} />
        <Route path="/trip-planner" element={<ProtectedRoute><TripPlanner /></ProtectedRoute>} />

        <Route path="/my-trips" element={<MyTrips />} />

        {/* Temple routes */}
        <Route path="/temples" element={
          <ProtectedRoute><TempleExplorer /></ProtectedRoute>
        } />
        <Route path="/temples/:placeId" element={          // ✅ THIS WAS MISSING
          <ProtectedRoute><TempleDetailsPage /></ProtectedRoute>
        } />

      </Routes>
    </BrowserRouter>
  );
}

export default App;