const mongoose = require("mongoose")

const retailerSchema = new mongoose.Schema({
  retailer_name:{
    type: String,
    required: true
  },
  username:{
    type: String,
    required: true
  },
  retailer_code:{
    type:String,
    required: true
  },
  password:{
    type: String,
    required: true
  },
  owner_name:{
    type: String,
    required: true
  },
  email:{
    type: String,
    required: false
  },
  address:{
    type: String,
    required: false
  },
  country:{
    type: String,
    required: false
  },
  phone:{
    type: String,
    required: false
  },
  email_recipients:{
    type: String,
    required: false
  },
  monogram_tagline:{
    type: String,
    required: false
  },
  retailer_logo:{
    type: String,
    required: false
  },
  role:{
    type:String,
    default:"retailer"
  },
  status:{
    type:Boolean,
    default:true
  }
}) 
const Retailer = mongoose.model("Retailer", retailerSchema)
module.exports = Retailer