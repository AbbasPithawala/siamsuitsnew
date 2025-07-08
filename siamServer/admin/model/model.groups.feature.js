const mongoose = require("mongoose")
const mongoosePaginate = require('mongoose-paginate-v2');
const groupedFeatureSchema = new mongoose.Schema({

  name:{
    type: String,
    required: true
  },

  thai_name:{
    type: String,
    required: true
  },

  product_id:{
    type: mongoose.Types.ObjectId,
    ref: "Product"
  },

  additional:{
    type: Boolean,
    default: false
  },

  feature_id: [{ type: mongoose.Types.ObjectId, ref: "Feature" }]

});

groupedFeatureSchema.plugin(mongoosePaginate);
const Group = mongoose.model("Group", groupedFeatureSchema);

module.exports = Group;