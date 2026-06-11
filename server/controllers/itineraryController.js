exports.optimizeRoute = (req, res) => {
  const places = req.body.places;

  // simple sorting (dummy logic)
  const sorted = places.sort((a, b) => a.lat - b.lat);

  res.json(sorted);
};