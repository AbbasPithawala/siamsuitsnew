const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const jobSchema = new mongoose.Schema({
    order_id: {
      type: mongoose.Types.ObjectId,
      ref: "Order",
    }, 
    group_order_id: {
      type: mongoose.Types.ObjectId,
      ref: "GroupOrder",      
    },
    customer:{
      type:String,
      required: false
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
    process:{
      type: mongoose.Types.ObjectId,
      ref: "Process",
      required: true
    },
    cost: {
        type: Number,
        required: true
    },
    stylingprice:{},
    product: {
        type: mongoose.Types.ObjectId,
        ref: "Product",
        // required: true
    },
    description: {
        type: String
    },
    extraPayments: [{
      type: mongoose.Types.ObjectId,
      ref: "ExtraPayments",
    }],
    status:{
      type: Boolean,
      default: false, 
      required: true 
    },
    paid: {
      type: Boolean,
      default: false
    },
    paidDate:{
      type: Number,
    },
    date: { 
      type: Number,
      default: Date.now()
    }
});

jobSchema.plugin(mongoosePaginate);
const Jobs = mongoose.model("Job", jobSchema);
module.exports = Jobs;    