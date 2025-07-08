const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const postionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    thai_name: {
        type: String
    },
    cost: {
        type: Number
    },
    product: {
        type: mongoose.Types.ObjectId,
        ref: "Product"
    },
    description: {
        type: String
    }
});

postionSchema.plugin(mongoosePaginate);
const Position = mongoose.model("Position", postionSchema);
module.exports = Position;    