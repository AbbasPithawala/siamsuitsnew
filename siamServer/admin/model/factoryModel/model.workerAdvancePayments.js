const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const workerAdvancePaymentSchema = new mongoose.Schema({

    worker: {
        type: mongoose.Types.ObjectId,
        ref: "Tailor"
    },
    title: {
        type:String,
        require: true
    },
    amount: {
        type: Number,
        required: true
    },
    cleared: {
        type: Boolean,
        default: false
    },
    date:{
        type : Number,
        default: Date.now()
        }
        
        
});


workerAdvancePaymentSchema.plugin(mongoosePaginate);
const WorkerAdvancePayment = mongoose.model("WorkerAdvancePayment", workerAdvancePaymentSchema);
module.exports = WorkerAdvancePayment;    