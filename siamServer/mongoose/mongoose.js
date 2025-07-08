const dotenv = require("dotenv")
const mongoose = require("mongoose")

dotenv.config();


// console.log(process.env.MONGOURL)

mongoose
  .connect(process.env.MONGOURL)
  .then(console.log("MongoDB connection successful"))
  .catch((err) => console.log(err.message));