const mongoose = require('mongoose');
const Schema =  mongoose.Schema

const apiInfoSchema = new Schema({
  expiresIn: {
    type: Number,
    required: true
  },
  token:{
    type:String,
    required: true
  },
  lastUpdate:{
    type: Number,
    required: true
  }
})


const paypalApiModel = mongoose.model("token",apiInfoSchema)
module.exports  = paypalApiModel
