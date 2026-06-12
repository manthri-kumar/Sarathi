// routes/templeRoutes.js

const express = require("express");
const router = express.Router();
const axios = require("axios");

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const query = `
      [out:json];
      node
        ["amenity"="place_of_worship"]
        ["religion"="hindu"]
        (around:10000,${lat},${lng});
      out body;
    `;

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      query,
      {
        headers: {
          "Content-Type": "text/plain"
        }
      }
    );

    res.json(response.data.elements);

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Failed to fetch temples"
    });
  }
});

module.exports = router;