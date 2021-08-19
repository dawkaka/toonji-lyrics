const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const breakdownsSchema = new Schema({
  songId:  String,
  punchlineId:String,
})

const barsSchema = new Schema({
  songId: String,
  punchlineId: String,
  punchlineText: String,
  saidBy: String
})
const awardNotifSchema = new Schema({
  userId: String,
  songId: String,
  punchlineId: String,
  type: String,
  brORcommentId: String,
  award:String
})

const usersSchema = new Schema({
  name: {
    type:String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  email:String,
  password:String,
  userCoins: {
    type: Number,
    default: 0
  },
  points: {
    type: Number,
    default: 0
  },
  singles: {
    type: Number,
    default: 0
  },
  albums:{
    type: Number,
    default: 0
  },
  ipAddress: {
    type:String,
  },
  isContributor: {
    type: Boolean,
    default: false
  },
  followers: [String],
  picture:String,
  bio: {
    type:String,
  },
  dateJoined: {
    type: Date,
  },
  verified:{
    type:Boolean,
    default: false
  },
  topFans: [{
    userId: String,
    atempts: Number,
    points: Number
  }],
  notifications: {
    followers: [String],
    likes: [{userId: String, songId: String, commentId: String}],
    upvotes: [{userId: String, songId: String, punchlineId: String, brId: String}],
    awards: [awardNotifSchema],
    others: [String],
  },
  favouriteSongs: [String],
  favouriteBars: [barsSchema],
  following: [String],
  favouriteGenres: [String],
  breakdowns: [breakdownsSchema],
  battles: [String]
});

const usersModel  = mongoose.model("user",usersSchema);
module.exports = usersModel;
