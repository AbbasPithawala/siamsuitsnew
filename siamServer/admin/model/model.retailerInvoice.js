const mongoose = require("mongoose")

const mongoosePaginate = require('mongoose-paginate-v2');
const invoiceSchema = new mongoose.Schema({

    retailer_code: {
        type: String,
        requried: true
    },

    retailer_name: {
        type: String,
        requried: true
    },

    invoice_number :{
        type: String,
        required: true
    },

    orders: [{
        type: mongoose.Types.ObjectId,
        ref: 'Order'
    }],

    total_price: {
        type: Number
    },


    shipping_charge: {
        type: Number
    },

    dueDate: {
        type: String,
        required: false
    },

    discount: {
        type: Number
    },

    total_amount: {
        type: Number
    },

    date:{
        type: Number,
        default: Date.now()
    }

});

invoiceSchema.plugin(mongoosePaginate);

const RetailerInvoices = mongoose.model("RetailerInvoices", invoiceSchema);

module.exports = RetailerInvoices;