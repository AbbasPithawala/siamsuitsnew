const mongoose = require("mongoose")

const productProcessSchema = new mongoose.Schema(
{
  name:{
    type: String,
    required: true
  },
  thai_name:{
    type:String,
    required: true
  },
  price:{
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: false
  },  
  status: {
    type: Boolean,
    default: true
  }
}) 


const Process = mongoose.model("Process", productProcessSchema)
module.exports = Process