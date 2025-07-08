const mongoose = require("mongoose")

const rolesSchema = new mongoose.Schema({
  
  role_name:{
    type: String,
    required: true
  },
  
  status: {
    type: Boolean,
    default: true
  },

  modules: [String],

  date: {
        type: Date,
        default: Date.now()
      }
}) 
const Roles = mongoose.model("Roles", rolesSchema)
module.exports = Roles