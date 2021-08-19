const mongoose = require('mongoose');

const Schema =  mongoose.Schema

const connectedUserSchema = new Schema({
  socketId: String,
  userId: String
})

const battleSchema = new Schema({
  battleId: String,
  battleOwner: String,
  createdDate: Date,
  ownerJoined: {
    type: Boolean,
    default: false
  },
  connectedUsers: [connectedUserSchema],
  battleInProcess: {
    type: Boolean,
    default: false
  }
})

const battlesModel = mongoose.model("battle",battleSchema)
module.exports = battlesModel
