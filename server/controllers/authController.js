const axios = require("axios");

/* GET NEARBY TEMPLES */
exports.getAllTemples = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Latitude and Longitude required",
      });
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=10000` +
      `&keyword=temple` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;

    const response = await axios.get(url);

    const temples = response.data.results.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 0,
      totalRatings: place.user_ratings_total || 0,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      photo: place.photos?.[0]
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_KEY}`
        : null,
    }));

    res.json(temples);

  } catch (err) {
    console.log(err.response?.data || err.message);

    res.status(500).json({
      message: "Failed to fetch temples",
      error: err.message,
    });
  }
};

/* GET TEMPLE DETAILS */
exports.getTempleById = async (req, res) => {
  try {
    const placeId = req.params.placeId;

    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;

    const response = await axios.get(url);

    res.json(response.data.result);

  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

/* SEARCH TEMPLES */
exports.searchTemples = async (req, res) => {
  try {
    const { search } = req.query;

    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${search}+temple` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;

    const response = await axios.get(url);

    res.json(response.data.results);

  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};