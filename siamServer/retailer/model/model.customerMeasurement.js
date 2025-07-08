const mongoose = require("mongoose")

const mongoosePaginate = require('mongoose-paginate-v2');
const customerSchema = new mongoose.Schema({
  firstname: {
    type: String
  },
  lastname: {
    type: String
  },
  fullname: {
    type: String
  },
  gender: {
    type: String
  },
  email: {
    type: String
  },
  phone: {
    type: Number
  },
  tag: {
    type: String
  },
  retailer_code: {
    type: String
  },
  measurementsObject: Object,
  suit: Object,
  tuxedo: Object,
  image: {
    type: String
  },
  imageNote: {
    type: String
  },
  
  date: {
    type: Number,
    default: Date.now()
  },
 
  manualSize: {},
});

customerSchema.plugin(mongoosePaginate);
const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;