import React, { useEffect, useRef } from "react";

const MapView = ({ places }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!window.google || !window.google.maps) return;

    const validPlaces = places.filter(p => p.lat && p.lng);

    console.log("Places:", validPlaces);

    if (validPlaces.length < 2) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: validPlaces[0],
      zoom: 12,
    });

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer();

    directionsRenderer.setMap(map);

    directionsService.route(
      {
        origin: validPlaces[0],
        destination: validPlaces[validPlaces.length - 1],
        waypoints: validPlaces.slice(1, -1).map((p) => ({
          location: p,
          stopover: true,
        })),
        travelMode: "DRIVING",
      },
      (result, status) => {
        if (status === "OK") {
          directionsRenderer.setDirections(result);
        } else {
          console.log("Directions failed:", status);
        }
      }
    );
  }, [places]);

  return (
    <div
      ref={mapRef}
      style={{ height: "100%", width: "100%", borderRadius: "20px" }}
    />
  );
};

export default MapView;