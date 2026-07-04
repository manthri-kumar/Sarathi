import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "./TempleDetails.css";
import Sidebar from "../../components/Sidebar/Sidebar";

const TempleDetailsPage = () => {
  const [temples, setTemples] = useState([]);
  const [filteredTemples, setFilteredTemples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCity, setSelectedCity] = useState("");

  const itemsPerPage = 12;
  const location = useLocation();

  // ═══════════════════════════════════════════════════════════════════════════
  // Get user location
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Parse city from URL
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const city = params.get("city");
    if (city) {
      setSelectedCity(decodeURIComponent(city));
    }
  }, [location.search]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch temples from backend
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const fetchTemples = async () => {
      try {
        setLoading(true);
        setError(null);

        let apiUrl = `${process.env.REACT_APP_BACKEND_URL}/api/temples`;

        if (selectedCity) {
          apiUrl += `?city=${encodeURIComponent(selectedCity)}`;
        } else if (userLocation) {
          apiUrl += `?lat=${userLocation.lat}&lng=${userLocation.lng}`;
        }

        const response = await axios.get(apiUrl);
        const templesData = response.data || [];

        setTemples(templesData);
        setFilteredTemples(templesData);
        setCurrentPage(1);
      } catch (err) {
        console.error("Error fetching temples:", err);
        setError("Failed to load temples. Please try again.");
        setTemples([]);
        setFilteredTemples([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedCity || userLocation) {
      fetchTemples();
    }
  }, [selectedCity, userLocation]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Handle search and filter
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const filtered = temples.filter((temple) => {
      const matchesSearch =
        temple.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        temple.address?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterType === "all" ||
        (filterType === "open" && temple.isOpen !== false) ||
        (filterType === "rated" &&
          temple.rating &&
          parseFloat(temple.rating) >= 4);

      return matchesSearch && matchesFilter;
    });

    setFilteredTemples(filtered);
    setCurrentPage(1);
  }, [searchTerm, filterType, temples]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Pagination logic
  // ═══════════════════════════════════════════════════════════════════════════
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTemples = filteredTemples.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredTemples.length / itemsPerPage);

  // ═══════════════════════════════════════════════════════════════════════════
  // Event handlers
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAIClick = () => {
    console.log("Sarathi AI clicked");
    // Add your AI handler logic here
  };

  const handleRefresh = () => {
    setLoading(true);
    // Re-fetch temples
    if (selectedCity || userLocation) {
      window.location.reload();
    }
  };

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to get your location. Please enable location services.");
        }
      );
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="temple-details-wrapper">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area - Full Width */}
      <div className="temple-details-container">
        {/* Hero Section - Full Width */}
        <div className="temple-hero-section">
          <div className="hero-content">
            <h1 className="hero-title">🏛️ Temple Discovery</h1>
            <p className="hero-subtitle">
              Find sacred temples near you, powered by Google Places
            </p>
          </div>
        </div>

        {/* Search & Filters Section - Full Width */}
        <div className="search-section">
          {/* Search Bar */}
          <div className="search-bar-container">
            <input
              type="text"
              placeholder="Search temples by city or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button className="search-button">
              <i className="fa-solid fa-magnifying-glass"></i> Search
            </button>
            <button className="location-button" onClick={handleLocationClick}>
              <i className="fa-solid fa-location-dot"></i> Using your location
            </button>
            <button className="refresh-button" onClick={handleRefresh}>
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
            <button className="ai-button" onClick={handleAIClick}>
              <i className="fa-solid fa-wand-magic-sparkles"></i> Sarathi AI
            </button>
          </div>

          {/* Filter Buttons */}
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              All Temples
            </button>
            <button
              className={`filter-btn ${filterType === "open" ? "active" : ""}`}
              onClick={() => setFilterType("open")}
            >
              Open Now
            </button>
            <button
              className={`filter-btn ${filterType === "rated" ? "active" : ""}`}
              onClick={() => setFilterType("rated")}
            >
              Top Rated (4★+)
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading temples...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>{error}</p>
            <button onClick={handleRefresh} className="retry-button">
              Retry
            </button>
          </div>
        ) : currentTemples.length === 0 ? (
          <div className="no-results">
            <p>No temples found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            {/* Temple Cards Grid - Full Width, Responsive */}
            <div className="temple-cards-grid">
              {currentTemples.map((temple) => (
                <div key={temple._id} className="temple-card">
                  {/* Card Image */}
                  <div className="card-image">
                    {temple.image ? (
                      <img
                        src={temple.image}
                        alt={temple.name}
                        className="image"
                      />
                    ) : (
                      <div className="image-placeholder">
                        <i className="fa-solid fa-gopuram"></i>
                      </div>
                    )}

                    {/* Distance Badge */}
                    {temple.distance && (
                      <div className="distance-badge">{temple.distance}</div>
                    )}

                    {/* Status Badge */}
                    {temple.isOpen !== undefined && (
                      <div
                        className={`status-badge ${
                          temple.isOpen ? "open" : "closed"
                        }`}
                      >
                        {temple.isOpen ? "Open Now" : "Closed"}
                      </div>
                    )}

                    {/* Like Button */}
                    <button className="like-button" aria-label="Add to favorites">
                      <i className="fa-solid fa-heart"></i>
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="card-content">
                    <h3 className="card-title">{temple.name}</h3>

                    {/* Rating & Reviews */}
                    {temple.rating && (
                      <div className="rating-section">
                        <div className="stars">
                          <i className="fa-solid fa-star"></i>
                          <span className="rating-value">
                            {parseFloat(temple.rating).toFixed(1)}
                          </span>
                          {temple.reviews && (
                            <span className="reviews-count">
                              ({temple.reviews})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {temple.address && (
                      <p className="card-address">
                        <i className="fa-solid fa-location-dot"></i>
                        {temple.address}
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="card-actions">
                      <button className="action-btn" aria-label="View temple details">
                        <i className="fa-solid fa-eye"></i> View Details
                      </button>
                      <button className="action-btn" aria-label="Ask Sarathi AI about this temple">
                        <i className="fa-solid fa-message"></i> Ask AI
                      </button>
                      <button className="action-btn" aria-label="Open in Google Maps">
                        <i className="fa-solid fa-map"></i> Maps
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn prev"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>

                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 &&
                        pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          className={`pagination-number ${
                            currentPage === pageNum ? "active" : ""
                          }`}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={currentPage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === currentPage - 2 ||
                      pageNum === currentPage + 2
                    ) {
                      return (
                        <span key={pageNum} className="pagination-ellipsis">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  className="pagination-btn next"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TempleDetailsPage;