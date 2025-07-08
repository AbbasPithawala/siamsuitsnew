const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
{
  name:{
    type: String,
    required: true
  },
  description:{
    type: String, 
    required: true
  },
  image:{
    type: String,
    required: false
  },
  features:[{
    type: mongoose.Types.ObjectId,
    ref: "Feature"
  }],
  measurements: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Measurement"
    }
  ], 
  process: []  
}) 


const Product = mongoose.model("Product", productSchema)
module.exports = Product