const mongoose = require("mongoose")

const featureSchema = new mongoose.Schema({

  name:{
    type: String,
    required: true
  },

  thai_name:{
    type: String,
    required: true
  },

  group_name:{
    type:String,
    required: false
  },

  product_id:{
    type:String,
    required: true
  },

  additional:{
    type: Boolean,
    default: false
  },

  styles:[{
    type: mongoose.Types.ObjectId,
    ref: "Style"
  }],

})  

const Feature = mongoose.model("Feature", featureSchema)

module.exports = Feature