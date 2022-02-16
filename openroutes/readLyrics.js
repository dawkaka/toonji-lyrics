const express = require('express');
const viewLyricsRoute = express.Router();
const songsModel = require('../database/mongooseSchemas/songsSchema');
const usersModel = require('../database/mongooseSchemas/usersSchema')


viewLyricsRoute.get('/api/:lyricsId',async (req,res)=> {
 try {
   let data = await songsModel.findOne({songId: req.params.lyricsId});
   if(data === null){
     return res.status(400).json({type:'ERROR', msg:'lyrcis not found'})
   }
   let userId = req.session.user === undefined ? false: req.session.user.userId
   let userFavData
   if(userId) userFavData = await usersModel.findOne({userId},{favouriteBars:1})
   let performanceData = getArtistPerformance(data.punchlines)
   let modefiedData = {
    views: numberToKOrM(data.views.length),
    songTitle: data.songTitle,
    favourited: userId ? data.favourited.some(a => a.userId === userId) : false,
    songArtist: data.songArtist,
    youtubeVideo: data.youtubeVideo,
    writers: data.writers,
    otherArtists: data.otherArtists,
    punchlines: data.punchlines.map(a => {
      let aa =  {
        rated: userId ? a.raters.some(a => a.userId === userId) : false,
        rating: a.raters.length,
        artist: a.artist,
        userFav: userId ? userFavData.favouriteBars.some(b => a._id.toString() === b.punchlineId):false,
        breakdowns: a.breakdowns,
        punchline: a.punchline,
        hasIcons: a.hasIcons === undefined ?  true : a.hasIcons === true ? true : false,
        _id: a._id
      }
      return aa
    }),
    noFavourited: data.favourited.length,
    raters: numberToKOrM(data.raters.length),
    rating: getRating(data.raters),
    userRating: userId ? getUserRating(data.raters,userId) : -1,
    rated: userId ? data.raters.some(a => a.userId === userId) : false
  }
  performanceData = performanceData.map(a => {
    return {
      artist: a.artist,
      points: numberToKOrM(a.points)
    }
  })
  return res.json({modefiedData,performanceData})
 } catch (e) {
   return res.status(500).json({type:'ERROR',msg:'something went wrong'})
 }
});

viewLyricsRoute.post('/api/report/:songId',async (req,res)=>{
   function notIn(arr,str){
     for(let i = 0; i < arr.length; i++){
       if(arr[i] === str){
         return false
       }
     }
     return true
   }
  let songId = req.params.songId
    try {
      let arr = [];
      let song = await songsModel.findOne({songId})
      for(let i = 0; i < Object.keys(req.body).length; i++){
        if(req.body[Object.keys(req.body)[i]] !== undefined
         && notIn(song.reports,req.body[Object.keys(req.body)[i]])) {
          arr.push(req.body[Object.keys(req.body)[i]])
        }
      }
      if(arr.length){
        let r = await songsModel.updateOne({songId},
          {$push: {reports: arr }})
      }
      return res.json({type:'SUCCESS',msg:"thanks, we will solve this as soon as possible"})
    } catch (e) {
      res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
})

function getUserRating(raters,userId){
  for(let i = 0; i < raters.length; i++) {
    if(raters[i].userId === userId){
      return raters[i].rate;
    }
  }
  return -1
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


function getArtistPerformance(punchlines) {
   let performanceOjbect = {}
   for(let i = 0; i < punchlines.length; i++){
     let current = punchlines[i]
     if(performanceOjbect[current.artist] === undefined) {
       performanceOjbect[current.artist] = {
         artist: current.artist,
         points: current.raters.length
       }
     }else {
       performanceOjbect[current.artist].points += current.raters.length
     }
   }
let performanceArray = [];
for(let i = 0; i < Object.keys(performanceOjbect).length; i++){
  performanceArray.push(
    performanceOjbect[Object.keys(performanceOjbect)[i]]
  )

}
   return performanceArray.sort((a,b)=> {
     return b.points - a.points
   }).filter(a => {
    return a.artist !== '' && a.artist !== undefined
   })
}




module.exports = viewLyricsRoute;
