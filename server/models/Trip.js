const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  name: String,
  image: String,
  date: String,
  time: String,
  budget: String,
  note: String
},
{ timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);