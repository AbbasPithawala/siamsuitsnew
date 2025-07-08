const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const groupOrderModelSchema = new mongoose.Schema({

  orderId: {
    type: String
  },

  retailer_id: {
    type: mongoose.Types.ObjectId,
    ref: "Retailer"
  },
  retailerName: {
    type : String,
  },
  retailer_code: {
    type : String,
  },

  name: { type: String },

  customer_quantity: { type: Number },

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

  product_quantity: {
    type: Number
  },

  // products: [],

  total_quantity: {
    type: Number
  },

  customers: [{
    type: mongoose.Types.ObjectId,
    ref: "Customer"
  }],
  manufacturing: {},
  
  workerprice: {},
  
  stylingprice:{},

  order_status: {
    type: String,
    default: "New Order"
  },

  rushOrderDate: {
    type: String,
    default:""
  },

  orderDate: {
    type: String
  },


  isCompleted: {  type: Boolean, default: false },

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

  orderCancle: {
    type: String,
    default: "No"
  },
  
  repeatOrder: {
    type: Boolean,
    default: false
  },

  orderPlaced: {
    type: Boolean,
    default: false
  },
  
  date: {
    type: Number,
    default: Date.now()
  }

});

groupOrderModelSchema.plugin(mongoosePaginate);
const GroupOrder = mongoose.model("GroupOrder", groupOrderModelSchema)
module.exports = GroupOrder;


