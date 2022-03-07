const mongoose = require('mongoose');

mongoose.connect(process.env.DB_HOST, {
 useNewUrlParser: true,
 useUnifiedTopology: true,
 useCreateIndex: true
});

const Schema = mongoose.Schema;
const punchlineBreakdown = new Schema({
  userId: String,
  date: String,
  breakdown:String,
  voters: [{
    userId: String,
    vote: String
  }],
  awards: {
    platinum: {
      type: Number,
      default: 0
    },
    diamond: {
      type: Number,
      default: 0
    },
    gold: {
      type: Number,
      default: 0
    },
    silver: {
      type: Number,
      default: 0
    },
    bronze: {
      type: Number,
      default: 0
    },
    copper: {
      type: Number,
      default: 0
    }
  }
});

const punchlinesSchema = new Schema({
 punchline : String,
 artist: String,
 raters: [{
   userId: String,
   date: Date
 }],
 breakdowns: [punchlineBreakdown],
 hasIcons: {
   type: Boolean,
   default: true
 }
})

const commentSchema = new Schema({
 userId: String,
 date: Date,
 commentText: String,
 likes: [{userId: String,reaction: String}],
 awards: {
   platinum: {
     type: Number,
     default: 0
   },
   diamond: {
     type: Number,
     default: 0
   },
   gold: {
     type: Number,
     default: 0
   },
   silver: {
     type: Number,
     default: 0
   },
   bronze: {
     type: Number,
     default: 0
   },
   copper: {
     type: Number,
     default: 0
   }
 }
})
const songsSchema = new Schema({
songId: String,
uploadedBy: String,
songArtist: String,
songTitle: String,
otherArtists: String,
producer: String,
favourited: [{
  userId: String,
  dateAdded: Date
}],
raters: [{
  userId: String,
  rate: Number,
  dateRated: Date,
}],
youtubeVideo: String,
releaseDate: String,
writers: String,
views: [Date],
reports: [String],
songCover: String,
songGenre: String,
uploadDate: Date,
punchlines: [punchlinesSchema],
comments: [commentSchema],
editors: [String]
});
const songsModel  = mongoose.model("song",songsSchema)
module.exports = songsModel
