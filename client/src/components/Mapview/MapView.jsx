import React, { useEffect, useRef } from "react";

const MapView = ({ places = [] }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!window.google || !window.google.maps) {
      console.log("Google Maps not loaded");
      return;
    }

    const validPlaces = places.filter(
      (p) =>
        p.lat &&
        p.lng &&
        !isNaN(p.lat) &&
        !isNaN(p.lng)
    );

    if (validPlaces.length === 0) return;

    const map = new window.google.maps.Map(
      mapRef.current,
      {
        center: {
          lat: validPlaces[0].lat,
          lng: validPlaces[0].lng,
        },
        zoom: 12,
      }
    );

    // Add markers
    validPlaces.forEach((place) => {
      new window.google.maps.Marker({
        position: {
          lat: place.lat,
          lng: place.lng,
        },
        map,
        title: place.name,
      });
    });

    if (validPlaces.length < 2) return;

    const directionsService =
      new window.google.maps.DirectionsService();

    const directionsRenderer =
      new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
      });

    directionsRenderer.setMap(map);

    directionsService.route(
      {
        origin: {
          lat: validPlaces[0].lat,
          lng: validPlaces[0].lng,
        },

        destination: {
          lat: validPlaces[
            validPlaces.length - 1
          ].lat,
          lng: validPlaces[
            validPlaces.length - 1
          ].lng,
        },

        waypoints: validPlaces
          .slice(1, -1)
          .map((place) => ({
            location: {
              lat: place.lat,
              lng: place.lng,
            },
            stopover: true,
          })),

        optimizeWaypoints: true,
        travelMode:
          window.google.maps.TravelMode.DRIVING,
      },

      (result, status) => {
        if (
          status ===
          window.google.maps.DirectionsStatus.OK
        ) {
          directionsRenderer.setDirections(
            result
          );
        } else {
          console.log(
            "Directions failed:",
            status
          );
        }
      }
    );

    return () => {
      directionsRenderer.setMap(null);
    };
  }, [places]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        borderRadius: "20px",
        overflow: "hidden",
      }}
    />
  );
};

export default MapView;
