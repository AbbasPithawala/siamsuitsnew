const mongoose = require("mongoose")

const draftSchema = new mongoose.Schema({
  customer_id: {
    type: String
  },
  retailer_code: {
    type: String
  },
  measurementsObject: Object,
  suit: Object,
  
  date: {
    type: Number,
    default: Date.now()
  }
});

// draftSchema.plugin(mongoosePaginate);
const DraftMeasurements = mongoose.model("DraftMeasurements", draftSchema);
module.exports = DraftMeasurements;