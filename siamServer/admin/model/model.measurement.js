const mongoose = require("mongoose")

const measurementSchema = new mongoose.Schema({
  name:{
    type: String,
    required: true
  },
  thai_name:{
    type: String,
    required: true
  },
  product_id:[String]
  
}) 
const Measurement = mongoose.model("Measurement", measurementSchema)
module.exports = Measurement