const Temple = require("../models/Temple");

/* GET ALL TEMPLES */
exports.getAllTemples = async (req, res) => {
  try {
    const { city, state, deity } = req.query;
    const filter = {};

    if (city) filter.city = city;
    if (state) filter.state = state;
    if (deity) filter.deity = deity;

    const temples = await Temple.find(filter).sort({ createdAt: -1 });
    res.status(200).json(temples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET TEMPLE BY ID */
exports.getTempleById = async (req, res) => {
  try {
    const temple = await Temple.findById(req.params.id);

    if (!temple) {
      return res.status(404).json({ message: "Temple not found" });
    }

    res.status(200).json(temple);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* SEARCH TEMPLES */
exports.searchTemples = async (req, res) => {
  try {
    const search = req.query.search;
    if (!search) {
      return res.status(400).json({ message: "Search query parameter is required" });
    }

    const temples = await Temple.find({
      name: { $regex: search, $options: "i" },
    });

    res.status(200).json(temples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* FEATURED TEMPLES */
exports.getFeaturedTemples = async (req, res) => {
  try {
    const temples = await Temple.find({ isFeatured: true });
    res.status(200).json(temples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};