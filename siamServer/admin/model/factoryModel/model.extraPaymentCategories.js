const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const extraPaymentCategoriesSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    thai_name: {
        type: String,
        required: true
    },
    product: {
        type: mongoose.Types.ObjectId,
        ref: "Product"
    },
    feature: {
        type: mongoose.Types.ObjectId,
        ref: "Feature"
    },
    style: {
        type: mongoose.Types.ObjectId,
            ref: "Style"
    },
    option_value: {
        type: String,
        required: false
    },
    cost: { 
        type: String
    }
});


extraPaymentCategoriesSchema.plugin(mongoosePaginate);
const ExtraPaymentCategories = mongoose.model("ExtraPaymentCategories", extraPaymentCategoriesSchema);
module.exports = ExtraPaymentCategories;    