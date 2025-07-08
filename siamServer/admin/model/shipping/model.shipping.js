const mongoose = require("mongoose");

const shippingBoxSchema = new mongoose.Schema({

    name: {
      type: String,
      required: true,
      unique: true
    },

    retailer: {
      type: mongoose.Types.ObjectId,
      ref: "Retailer"
    },

    order_id: [{
      type: mongoose.Types.ObjectId,
      ref: "Order"
    }],

    items: [],

    tracking_code:{
      type: String
    },

    isClosed: {
      type: Boolean,
      default: false
    },

    status: {
      type: Boolean,
      default: true
    }
    ,
    date: {
      type: Number,
      default: Date.now()
    }

});


const ShippingBox = mongoose.model("ShippingBox", shippingBoxSchema);
module.exports = ShippingBox;    