const express = require('express');
const homeRoute = express.Router();
const songsModel = require('../database/mongooseSchemas/songsSchema');
const usersModel = require('../database/mongooseSchemas/usersSchema')

homeRoute.get('/api',async (req,res)=> {
  try {
    let userId = req.session.user ? req.session.user.userId : false;
    let seen = [];
    if(userId) {
      let viewed = await usersModel.findOne({userId},{viewed: 1})
      seen = viewed.viewed.map(a => a.songId)
      seen = Array.from(new Set(seen))
    }

    let songs = await songsModel.find({songId: {$nin: seen}}).sort({uploadDate:-1});
    let recommended = getTopNine(songs,getRating,9)
    let newArrivals = songs.splice(0,9)
    recommended = recommended.map(song => {
      let hottesBar = findHottestBar(song)

    return  {
      songTitle: song.songTitle,
      songArtist: song.songArtist,
      hottesBar: hottesBar.punchline,
      songId: song.songId,
      barPreview: barPreview(hottesBar.punchline),
      artist: hottesBar.artist,
      fires: numberToKOrM(hottesBar.raters.length),
      rating: getRating(song.raters),
      comments: numberToKOrM(song.comments.length),
      views: numberToKOrM(song.views.length),
      otherArtists: song.otherArtists,
      favourited: song.favourited.length,
      isFav: userId ? song.favourited.some(a => a.userId === userId) : false,
      songCover: process.env.IMAGEURL + song.songCover,
    }
    })
    newArrivals = newArrivals.map(song => {
      let hottesBar = findHottestBar(song)
    return  {
      songTitle: song.songTitle,
      songArtist: song.songArtist,
      hottesBar: hottesBar.punchline,
      songId: song.songId,
      barPreview: barPreview(hottesBar.punchline),
      artist: hottesBar.artist,
      fires: numberToKOrM(hottesBar.raters.length),
      rating: getRating(song.raters),
      comments: numberToKOrM(song.comments.length),
      views: numberToKOrM(song.views.length),
      otherArtists: song.otherArtists,
      favourited: numberToKOrM(song.favourited.length),
      isFav: userId ? song.favourited.some(a => a.userId === userId) : false,
      songCover: process.env.IMAGEURL + song.songCover,
    }
    })
    res.json({songs:recommended,newArrivals:newArrivals})
  }catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
});

homeRoute.get('/api/search/:searchId',async (req,res)=>{
    let searchId = req.params.searchId
    searchId = searchId.replace(/\W/g,"")
   try {
    const songs = await songsModel.find({songTitle:{$regex:"^"+searchId,$options:'i'}},{songId: 1, songTitle: 1, songCover: 1, songArtist: 1})
    const users = await usersModel.find({name:{$regex:"^"+req.params.searchId,$options:'i'}},{name: 1, picture: 1, verified: 1, points: 1})

    const data = {songs: songs.map(song => {
      song.songCover = process.env.IMAGEURL + song.songCover
      return song
    }),
    users:   users.map(user => {
      user.picture = process.env.IMAGEURL + user.picture
      return user
    })}
    res.json(data)
    }catch(err) {
     res.status(400).json({type:'ERROR',msg:'something went wrong'})
     }
   })


function getTopNine(songs,getRating,n) {
  songs = songs.sort((a,b) => {
    return  (b.views.length + b.favourited.length + getRating(b.raters)) -
    ( a.views.length + a.favourited.length + getRating(a.raters))
  })
  return songs.splice(0,n);
}

function numberToKOrM(n) {
  n = n.toString()
  if(n.length <= 3) {
    return n
  }else if(n.length <= 6 ) {
    let afterPoint = n.substr(n.length - 3)
    let beforePoint = n.substr(0,n.length - 3);
    return `${beforePoint}.${afterPoint[0]}k`
  }else if(n.length > 6 && n.length < 9) {
     let afterPoint = n.substr(n.length - 6)
     let beforePoint = n.substr(0,n.length - 6);
     return `${beforePoint}.${afterPoint[0]}${afterPoint[1]}M`
   }else if(n.length >= 9) {
     let afterPoint = n.substr(n.length - 9)
     let beforePoint = n.substr(0,n.length - 9);
     return `${beforePoint}.${afterPoint.substr(0,2)}B`
   }
}

function findHottestBar(lyric) {
   let max = lyric.punchlines[0];
   for(let i = 0; i < lyric.punchlines.length; i++) {
     if(lyric.punchlines[i].raters.length > max.raters.length) {
       max = lyric.punchlines[i];
     }
   }
   return max;
}

 function barPreview(bar) {
  return bar.substr(0,100) + "..."
}

function getRating(raters) {
  let totalRating = 0;
  let elemCount = 0;
  for(let i = 0; i < raters.length; i++){
       totalRating += raters[i].rate
       elemCount++
  }
  let rating = isNaN(totalRating/elemCount) ? 0 : totalRating/elemCount;
  return rating.toPrecision(2)
}

function isInFavourites(songId,favourites) {
  if(!Array.isArray(favourites)) {
    return false;
  }
   for(let i = 0; i < favourites.length; i++) {
     if(favourites[i] === songId) return true;
   }
   return false
}


   function generateID() {
     let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
     let str = '';
     for(let i = 0; i < 11; i++) {
       str += chars[Math.floor((Math.random() * (chars.length)))];
     }
     return str
   }



module.exports = homeRoute;
