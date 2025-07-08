const mongoose = require('mongoose')

const styleSchema = new mongoose.Schema({
  name:{
    type: String,
    required: true
  },

  thai_name:{
    type: String,
    required: true
  },

  image:{
    type:String,
    required: false
  },

  price:{
    type: Number,
    required: false
  },

  worker_price:{
    type: Number,
    required: false   
  },
  
  feature_id:{
    type:String,
    required: true
  },

  style_options:[{
    name: {
      type: String
    },
    thai_name: {
      type: String
    },
    image: {
      type: String
    }
  }]

})

const Style = mongoose.model("Style", styleSchema);

module.exports = Style;