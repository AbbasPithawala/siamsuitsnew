const mongoose = require("mongoose")

const mongoosePaginate = require('mongoose-paginate-v2');

const orderSchema = new mongoose.Schema({
  
  orderId: {
    type: String,
    unique: true,
    required: true,
    dropDups: true
  },
  
  customerName: {
    type: String
  },
  
  retailerName: {
    type: String
  },
  
  retailer_id: {
    type: mongoose.Types.ObjectId,
    ref: "Retailer"
  },
  
  retailer_code: {
    type: String
  },
  
  customer_id: {
    type: mongoose.Types.ObjectId,
    ref: "Customer"
  },

  measurements: Object,

  Suitmeasurements: Object,
  Tuxedomeasurements: Object,
  order_items: [
    {
      item_name: {
        type: String
      },
      item_id:{
        type: String,
      },
      quantity: {
        type: Number
      },
      styles: []
    }
  ],
  
  total_quantity: {
    type: Number
  },
    
  manufacturing:{},
  workerprice: {},
  stylingprice: {},
    
  order_status: {
    type: String,
    default: "New Order"
  },

  rushOrderDate: {
    type: String,
    default:""
  },
  
  manualSize: {},
  
  invoice:{
    note:{
      type:String
    },
    items:[
      {
        item_name:{
          type: String
        },
        item_code:{
          type: String
        },
        fabric:{
          type: String
        },
        price:{
          type: Number,
          default:0
        },
        styles:{},
        additional_charges:[]
       }
    ],
    total_amount:{
      type: Number,
      default:0
    },
    option:[
      {
        name: { type: String },
        price: { type: Number, default:0}
      }
    ]
  },

  invoiceSent: {
    type: Boolean,
    default: false
  },
   
  invoiceCreate:{
    type: Boolean,
    default: false
  },

  OrderDate: {
    type: String,
    default:""
  },

  orderCancle: {
    type: String,
    default: "No"
  },
  
  repeatOrder: {
    type: Boolean,
    default: false
  },

  repeatOrderID: {
    type: String
  },

  pdf:{
    type: String
  },

  type: {
    type: String,
    enum: ['normal', 'group'],
    default: "normal"
  },
  groupOrderID:{
    type: mongoose.Types.ObjectId,
    ref: "GroupOrder"
  },
  date: {
    type: Number,
    default: Date.now()
  }
}
);

orderSchema.plugin(mongoosePaginate);
const Order = mongoose.model("Order", orderSchema)
module.exports = Order;
