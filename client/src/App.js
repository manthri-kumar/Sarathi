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


/* 🔐 Protected Route */
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" />;
};

/* 🔁 Public Route — allow through if hash has OAuth token (mid-callback) */
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const isOAuthCallback = window.location.hash.includes("access_token");

  // Don't redirect if we're mid-OAuth — AuthPage will handle it
  if (token && !isOAuthCallback) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
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

        {/* ✅ FIXED: Itinerary INSIDE Routes */}
        <Route
          path="/itinerary"
          element={
            <ProtectedRoute>
              <Itinerary />
            </ProtectedRoute>
          }
        />

        <Route path="/my-trips" element={<MyTrips />} />
        <Route
  path="/saved"
  element={
    <ProtectedRoute>
      <Saved />
    </ProtectedRoute>
  }
/>
<Route
 path="/profile"
 element={
   <ProtectedRoute>
     <Profile />
   </ProtectedRoute>
}
/>
<Route
  path="/day-planner"
  element={
    <ProtectedRoute>
      <DayPlanner />
    </ProtectedRoute>
  }
/>

<Route
  path="/trip-planner"
  element={
    <ProtectedRoute>
      <TripPlanner />
    </ProtectedRoute>
  }
/>

<Route path="/temples" element={<ProtectedRoute><TempleExplorer /></ProtectedRoute>} />


<Route
  path="/trip-planner"
  element={<TripPlanner />}
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;