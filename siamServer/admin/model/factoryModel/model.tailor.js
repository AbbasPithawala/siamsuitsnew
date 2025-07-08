const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const tailorSchema = new mongoose.Schema({

    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String
    },
    thai_fullname: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    process_id: [
        { 
            type: mongoose.Types.ObjectId,
            ref: "Process"
        }
    ],
    username: {
        type: String
    },
    password: {
        type: Number
    },
    phone: {
        type: Number
    },
    advancePayment:{
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default:true
    }
});


tailorSchema.plugin(mongoosePaginate);
const Tailor = mongoose.model("Tailor", tailorSchema);
module.exports = Tailor;    