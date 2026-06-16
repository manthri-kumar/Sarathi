const getRecommendations = async (req, res) => {
  return res.json({
    recommendations: [
      {
        id: "1",
        name: "Araku Valley",
        location: "Andhra Pradesh",
        rating: 4.8,
        reviews: 1200,
        lat: 18.327,
        lng: 82.880,
        distance: 110,
        category: "Popular",
        photo: null,
      },
    ],
  });
};

module.exports = {
  getRecommendations,
};