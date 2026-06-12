const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "lat and lng required",
      });
    }

    const query = `
[out:json];
node
["amenity"="place_of_worship"]
["religion"="hindu"]
(around:10000,${lat},${lng});
out body;
`;

    const response = await axios({
      method: "post",
      url: "https://overpass-api.de/api/interpreter",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: `data=${encodeURIComponent(query)}`,
    });

    res.json(response.data.elements);

  } catch (err) {
    console.log(err.response?.data || err.message);

    res.status(500).json({
      message: "Failed to fetch temples",
      error: err.message,
    });
  }
});

module.exports = router;