const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const extraPaymentsSchema = new mongoose.Schema({
    order_id: {
      type: mongoose.Types.ObjectId,
      ref: "Order"
    },
    group_order_id: {
      type: mongoose.Types.ObjectId,
      ref: "GroupOrder"
    },
    tailor: {
      type: mongoose.Types.ObjectId,
      ref: "Tailor",
      required: true
    },
    item_code: {
        type: String,
        required: true
    },
    extraPaymentCategory:{
      type: mongoose.Types.ObjectId,
      ref: "ExtraPaymentCategories",
      required: true
    },
    cost: {
        type: Number,
        required: true
    },
    product: {
        type: mongoose.Types.ObjectId,
        ref: "Product"
    },
    description: {
      type: String
    },
    authorizedBy :{
      type: String
    },
    status:{
      type: Boolean,
      default: true, 
    },
    approved: {
      type: Boolean,
      default: false
    },
    paid: {
      type: Boolean,
      default: false
    },
    paidDate:{
      type: Number,
      default: Date.now()
    },
    date: {
      type: Number,
      default: Date.now()
    }
});

extraPaymentsSchema.plugin(mongoosePaginate);
const ExtraPayments = mongoose.model("ExtraPayments", extraPaymentsSchema);
module.exports = ExtraPayments;    