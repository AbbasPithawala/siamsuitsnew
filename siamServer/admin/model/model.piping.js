const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const PipingSchema = new mongoose.Schema({
    pipingCode: { type: String },
    supplierName: { type: String },
    image: { type: String },
    date: { type: Date, default: Date.now() }
});

PipingSchema.plugin(mongoosePaginate);
const Piping = mongoose.model("Piping", PipingSchema);
module.exports = Piping;    