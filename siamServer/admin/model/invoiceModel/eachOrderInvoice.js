const mongoose = require("mongoose");
const eachOrderInvoiceSchema = new mongoose({
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "Order"
    },
    products: [
      {
        product_name: { type: String },
        
      }
    ]

});