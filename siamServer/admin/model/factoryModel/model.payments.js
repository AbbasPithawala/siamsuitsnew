const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const paymentSchema = new mongoose.Schema({
    job: [{
      type: mongoose.Types.ObjectId,
      ref: "Job",
    }],
    extraPaymentCategory: [{
        type: mongoose.Types.ObjectId,
        ref: "ExtraPayments",
      }],
    tailor: {
        type: mongoose.Types.ObjectId,
        ref: "Tailor",
        required: true
    },
    subTotal: {
        type: Number,
        required: true
    },
    deductedAdvance: {
        type: Number
    },
    manualBill: {
        type: Number
    },
    tailorAdvance: {
        type: Number,
        required: true
    },
    rent: {
        type: Number
    },
    totalPay: {
        type: Number,
        required: true
    },
    date: { 
      type: Number,
      default: Date.now()
    }
});

paymentSchema.plugin(mongoosePaginate);
const Payments = mongoose.model("Payments", paymentSchema);
module.exports = Payments;    