const getRecommendations = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Latitude and longitude required",
      });
    }

    return res.json({
      recommendations: [],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch recommendations",
    });
  }
};

module.exports = {
  getRecommendations,
};