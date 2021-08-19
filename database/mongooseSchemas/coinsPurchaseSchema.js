const mongoose = require('mongoose');

const Schema =  mongoose.Schema

const coinsPurchases = new Schema({
  link: String,
  userId: String,
  payerEmail: String,
  amount: Number,
  completed: {
    type: Boolean,
    default: false,
  }
})

const coinsPurchasesModel = mongoose.model("coinsPurchase",coinsPurchases)

module.exports = coinsPurchasesModel;
