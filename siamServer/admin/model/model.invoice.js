const mongoose = require("mongoose")

const mongoosePaginate = require('mongoose-paginate-v2');
const invoiceSchema = new mongoose.Schema({

 retailer_code:{
  type: String,
  requried: true
 },
 orderid: {
  type: String,
  required: true
 },
 order_date:{
  type: Number,
  required: false
 },
 products:[{
  name:{
    type: String
  },
  price:{
    type: Number
  }
 }],
 total_price:{
  type: Number
 },
 shipping_charge:{
  type: Number
 },
 paid_date:{
  type: Number,
  required: false
  },
 discount:{
  type: Number
 },
 total_amount:{
  type: Number
 },
 payment_method: {
  type: String
 }

});

invoiceSchema.plugin(mongoosePaginate);
const Invoice = mongoose.model("Invoice", invoiceSchema);
module.exports = Invoice;