const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema({
  order_id:{
    type: String,
    required: true
  },
  order_items:[
    {
      item_name: {
        type: String, 
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        required: false
      }
    }
  ],
      order_status: {
        type: String,
        require: true,
        default: "Incomplete"
      },

      created_by : {
        type: String,
        required: true,
        default: "Admin"
      },
      date: {
        type: Date,
        default: Date.now()
      }
}) 


const ManualOrder = mongoose.model("ManualOrder", orderSchema)
module.exports = ManualOrder