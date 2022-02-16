const express = require('express');
const favouritesRouter = express.Router();
const validate = require('../validate');
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const songsModel = require('../../database/mongooseSchemas/songsSchema')

favouritesRouter.get('/api/my/favourites/:favParam',validate,async (req,res)=>{
   try {
     const filter = req.params.favParam
     if(filter === "songs"){
     let favourites = await usersModel.findOne({userId: req.session.user.userId},
       {favouriteSongs:1})
     let favouriteSongs = await songsModel.find({songId:
       {$in:favourites.favouriteSongs}})
       let songs =  favouriteSongs.map(song => {
         let hottesBar = findHottestBar(song)
       return  {
         songTitle: song.songTitle,
         songArtist: song.songArtist,
         hottesBar: hottesBar.punchline,
         songId: song.songId,
         barPreview: barPreview(hottesBar.punchline),
         fires: numberToKOrM(hottesBar.raters.length),
         rating: getRating(song.raters),
         comments: numberToKOrM(song.comments.length),
         views: numberToKOrM(song.views.length),
         favourited: song.favourited.length,
         otherArtists: song.otherArtists,
         isFav: true,
         songCover: process.env.IMAGEURL + song.songCover,
       }
       })
       res.json(songs)
       return
     }else if (filter === "bars") {
       let favourites = await usersModel.findOne({userId: req.session.user.userId},
         {favouriteBars:1})
       let favSongId =  favourites.favouriteBars.map(a => a.songId)
       let favouriteBarsInfo = await songsModel.find({songId:
         {$in:favSongId}},{songId:1,songTitle:1,songArtist:1, otherArtists:1})
       let favBarObj = {}
       for(let i = 0; i < favouriteBarsInfo.length; i++) {
         let curr = favouriteBarsInfo[i]
         if(!favBarObj[`${curr.songId}`]){
           favBarObj[`${curr.songId}`] = {
             songTitle: curr.songTitle,
             songArtist: curr.songArtist,
             otherArtists: curr.otherArtists
           }
         }
       }

      let favBars = favourites.favouriteBars
      favBars = favBars.map( a => {
          return {
            saidBy: a.saidBy,
            bar: a.punchlineText,
            songId: a.songId,
            id: a.punchlineId,
            userFav: true,
            songTitle: favBarObj[`${a.songId}`].songTitle,
            songArtist: favBarObj[`${a.songId}`].songArtist,
            otherArtists: favBarObj[`${a.songId}`].otherArtists
          }
      })
      res.json(favBars)
      return
     }
      res.status(400).json({type:'ERROR',msg: "something went wrong"})
   } catch (e) {

     return res.status(500).json({type:'ERROR',msg:'something went wrong'})
   }
})

favouritesRouter.post("/api/bar-favourited/:songId/:barId",validate,async(req,res)=> {
  try {
    const {songId,barId} = req.params
    const userId = req.session.user.userId
    let userFavBars = await usersModel.findOne({userId},{favouriteBars:1})
    if(userFavBars.favouriteBars.some(a => a.punchlineId === barId)) {
      let see = await usersModel.updateOne({userId},{$pull: {favouriteBars: {punchlineId:barId}}})
      return res.json({type:'SUCCESS',msg:'removed from favourite bars'})
    }else {
      let song = await songsModel.findOne({songId},{punchlines:1})
      if(!song) return res.status(400).json({type:'ERROR',msg:'lyrics not found'})
      let targetPunchline;
      for(let i = 0; i < song.punchlines.length; i++) {
        if(song.punchlines[i]._id.toString() === barId) {
          targetPunchline = song.punchlines[i]
          break
        }
      }
      if(!targetPunchline) return res.status(400).json({type:'ERROR',msg:'bar could not be found'})
      let favBarObj = {
        saidBy: targetPunchline.artist,
        punchlineId: barId,
        songId: songId,
        punchlineText: targetPunchline.punchline
      }
      let see = await usersModel.updateOne({userId},{$push: {favouriteBars: favBarObj}})
      if(see) return res.json({type:'SUCCESS',msg:'bar added to favouites'})
        res.status(400).json({type:'ERROR',msg:'something went wrong'})
    }
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

favouritesRouter.post('/api/favourited/:songId',validate, async(req,res)=>{
  let song = "";
  try {
    song = await songsModel.findOne({songId:req.params.songId});
  } catch (e) {
    return res.status(400).json({type:'ERROR',msg:'something went wrong'})
  }
 if(song !== null) {
     let alreadyAdded = false;
     for(let i = 0; i < song.favourited.length; i++) {
       if(song.favourited[i].userId === req.session.user.userId) {
         alreadyAdded = true;
         break;
       }
     }
  if(!alreadyAdded){
   try {
     await songsModel.updateOne({songId: req.params.songId},
       {$push: {favourited: {userId: req.session.user.userId, dateAdded: new Date()}}})
     await usersModel.updateOne({userId: req.session.user.userId},
      {$push: {favouriteSongs: req.params.songId}})
    return res.json({type:"SUCCESS",msg:'added to favourites'})
   } catch (e) {

     return res.status(500).json({type:'ERROR',msg:'something went wrong'})
   }
 }else {
   await songsModel.updateOne({songId: req.params.songId},
     {$pull: {favourited: {userId:req.session.user.userId}}})
   await usersModel.updateOne({userId: req.session.user.userId},
      {$pull: {favouriteSongs: req.params.songId}})
    return res.json({type:"SUCCESS",msg:'removed to favourites'})
 }
}else {
  return res.status(500).json({type:'ERROR',msg:'song not found'})
}
})


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


module.exports = favouritesRouter;
