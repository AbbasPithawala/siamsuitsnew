const mongoose = require("mongoose")

const customFittingsSchema = new mongoose.Schema({
  product_id:{
    type: String,
    required: true
  },
  fitting_name:{
    type: String
  },
  measurements:
  [{
    measurement_id:{
      type: String
    }, 
    measurement_name:{
      type: String
    },  
    fitting_value: {
      type: Number
    }
  }]
});


const customFittings = mongoose.model("customFittings", customFittingsSchema);
module.exports = customFittings;