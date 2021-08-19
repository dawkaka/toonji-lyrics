const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const battleUserInfo = new Schema({
   userId: String,
   socketId: String,
   userPoints: {
     type: Number,
     default: 0
   }
})

const allBattlesSchema = new Schema({
  battleId: String,
  battleOwner: battleUserInfo,
  opponent: battleUserInfo
})

const allBattlesModel = mongoose.model("allBattle",allBattlesSchema)

module.exports = allBattlesModel
