import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/Auth/AuthPage";
import Dashboard from "./pages/Dashboard";
import Itinerary from "./pages/Itinerary";
import Explore from "./pages/Explore";

/* 🔐 Protected Route */
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" />;
};

/* 🔁 Public Route */
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/dashboard" /> : children;
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;