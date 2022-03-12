const express = require('express');
const profileRoute = express.Router();
// const ensureAuthenticated = require('../validate.js');
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const songsModel = require('../../database/mongooseSchemas/songsSchema')
const allBattlesModel = require('../../database/mongooseSchemas/allBattlesSchema')
const requestReportModel = require('../../database/mongooseSchemas/requestAndReports')
const validate = require('../validate');

profileRoute.post('/api/p/log-out',async(req,res)=> {
  try {
    req.session.destroy()
    res.clearCookie("contributor")
    res.clearCookie("_user_id")
    res.json({type:'SUCCESS',msg:'loged out'})
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})


profileRoute.get('/api/p/notifications-count',async(req,res)=> {
    try {
      if(!req.session.user) return res.json({count: 0})

      let userNotifs = await usersModel.findOne({userId: req.session.user.userId},
                                                   {notifications:1})
      const {awards,likes, others, upvotes,followers} = userNotifs.notifications
      res.json({count: likes.length + awards.length + others.length + upvotes.length + followers.length})
    } catch (e) {
      console.log(e)
      res.status(500).json({type:'ERROR', msg: 'something went wrong'})
    }
})

profileRoute.get('/api/p/notifications',validate,async(req,res)=> {
  try {
  let userNotifs = await usersModel.findOne({userId: req.session.user.userId},
                                               {notifications:1})

  userNotifs = userNotifs.notifications
  userNotifs.others = [...userNotifs.others]

  let userIds = new Set();
  let songIds = new Set();
  for(let i = 0; i < userNotifs.followers.length; i++) {
    userIds.add(userNotifs.followers[i])
  }
  for(let i = 0; i < userNotifs.awards.length; i++){
    userIds.add(userNotifs.awards[i].userId)
    songIds.add(userNotifs.awards[i].songId)
  }
  for(let i = 0; i < userNotifs.likes.length; i++){
    userIds.add(userNotifs.likes[i].userId)
    songIds.add(userNotifs.likes[i].songId)
  }
  for(let i = 0; i < userNotifs.upvotes.length; i++){
    userIds.add(userNotifs.upvotes[i].userId)
    songIds.add(userNotifs.upvotes[i].songId)
  }
  if(Array.from(userIds).length < 1) return res.json({notifications:[],awards:[],likes:[],upvotes:[],followers:[]})
  const usersInfo = await usersModel.find({userId: {$in:Array.from(userIds)}},{userId:1,name:1})
  const songsInfo = await songsModel.find({songId: {$in:Array.from(songIds)}},{songId:1,songTitle:1,punchlines:1,comments:1})

  const userMap = usersInfo.reduce((a,b) => {
     a[`${b.userId}`] = b.name
     return a
  },{})

  const songsMap = songsInfo.reduce((a,b) => {
       a[`${b.songId}`] = {
         punchlines: b.punchlines,
         comments: b.comments,
         songTitle: b.songTitle
       }
       return a
  },{})

  userNotifs.followers = userNotifs.followers.map(a => userMap[`${a}`])

  userNotifs.awards = userNotifs.awards.map(a =>{
    let textPreview = "";
    if(a.type === "comment") {
      let song = songsMap[`${a.songId}`]
    if(song){
      for(let i = 0; i < song.comments.length; i++){
        if(song.comments[i]._id.toString() === a.brORcommentId) {
          textPreview = song.comments[i].commentText.substr(0,27)
        }
      }
    }
    }else {
      let barArr = songsMap[`${a.songId}`].punchlines.filter(p => p._id.toString() === a.punchlineId )
      let bar = barArr.length > 0 ? barArr[0] : ""
      if(bar != ""){
      for(let i = 0; i < bar.breakdowns.length; i++){
        if(bar.breakdowns[i]._id.toString() === a.brORcommentId) {
          textPreview = bar.breakdowns[i].breakdown.substr(0,27)
        }
      }
     }
    }
    return Object.assign(a,{userId:userMap[`${a.userId}`],brORcommentId:textPreview})
  })

  userNotifs.likes = userNotifs.likes.map(a => {
    let textPreview = "";
      let song = songsMap[`${a.songId}`]
      for(let i = 0; i < song.comments.length; i++){
        if(song.comments[i]._id.toString() === a.commentId) {
          textPreview = song.comments[i].commentText.substr(0,27)
        }
      }
    return Object.assign(a,{userId:userMap[`${a.userId}`],commentId: textPreview})
  })

  userNotifs.upvotes = userNotifs.upvotes.map(a => {
     let textPreview = ""
    let barArr = songsMap[`${a.songId}`].punchlines.filter(p => p._id.toString() === a.punchlineId )
    let bar = barArr.length > 0 ? barArr[0] : ""
    if(bar != ""){
    for(let i = 0; i < bar.breakdowns.length; i++){
      if(bar.breakdowns[i]._id.toString() === a.brId) {
        textPreview = bar.breakdowns[i].breakdown.substr(0,27)
      }
    }
   }
     return Object.assign(a,{userId:userMap[`${a.userId}`], brId: textPreview})
  })

   res.json(userNotifs)

 } catch (e) {

   res.status(500).json({type:'ERROR',msg:'something went wrong'})
 }
})

profileRoute.delete('/api/p/notifications',validate,async(req,res) => {
  try {
    await usersModel.updateOne({userId: req.session.user.userId},
                               {$set:{"notifications.followers": [],
                                      "notifications.likes":[],"notifications.awards":[],
                                      "notifications.upvotes":[],"notifications.others":[]}})
    res.json({type:'SUCCESS',msg:''})
  } catch (e) {
      res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }

})


profileRoute.post('/api/p/contributor-request',validate,async(req,res)=>{
    try {
         const {reason} = req.body
         const userId = req.session.user.userId
         if(req.session.user.isContributor) return res.json({type:'SUCCESS',ms:"you're already a contributor"})
         const request = await requestReportModel.findOne({userId,rrType:'contributor-request'})
         if(request) {
           return res.json({type:"ERROR",msg:"you've already submited a request"})
         }
         const rr = new requestReportModel({
           userId: userId,
           rrMessage:  reason,
           rrType: 'contributor-request'
         })
         rr.save(e => {
           if (e) {
            return res.status(400).json({type:'ERROR',msg:"couldn't complete request"})
           }
            res.json({type:'SUCCESS',msg:"request completed, we will notify you when your request has been accepted"})
         })
           } catch (e) {

      res.status(400).json({type:'ERROR',msg: 'something went wrong'})
    }
})

profileRoute.post('/api/p/bug-report',validate,async(req,res)=> {
  try {
       const {reason} = req.body
       const userId = req.session.user.userId
       const rr = new requestReportModel({
         userId: userId,
         rrMessage:  reason,
         rrType: 'bug-report'
       })
       rr.save(e => {
         if (e) {
          return res.status(500).json({type:'ERROR',msg:"couldn't complete the bug report"})
         }
          res.json({type:'SUCCESS',msg:"thank you for reporting the bug, it will be solved expeditiously."})
       })
         } catch (e) {

          res.status(500).json({type:'ERROR',msg: 'something went wrong'})
  }
})


profileRoute.get('/api/p/:name',async(req,res)=>{
  try{
  if(req.params.name === undefined) {
    return res.status(400).json({type:'ERROR',msg:'user not found'})
  }
  let songs = await songsModel.find({songArtist:req.params.name})
  let data = await usersModel.findOne({name: req.params.name });
  if(data === null) return res.status(400).json({type:'ERROR',msg: 'user not found'})
  let userId = req.session.user ? req.session.user.userId : false
  let battles = await allBattlesModel.find({battleId: {$in: data.battles}})
  battles = battles.filter(a => a.battleOwner.userId && a.opponent.userId && a.battleOwner.userPoints !== 0 && a.opponent.userPoints !== 0)
  let battleRecords = getBattleRecords(battles,data.userId)
  data = {
    name: data.name,
    verified: data.verified,
    topFans: data.topFans.length,
    followers: data.followers.length,
    following: userId ? data.followers.some(a => a === userId) : false,
    points: data.points,
    bio: data.bio,
    noSongs: songs.length,
    picture: process.env.IMAGEURL + data.picture,
    battleRecord: battleRecords
  }
  res.json(data)
}catch(e) {

  res.status(500).json({type:'ERROR',msg:'something went wrong'})
}
})

profileRoute.get('/api/p/followers/:name/:fetch',async(req,res)=> {
  try {
   let {name,fetch} = req.params
   fetch = parseInt(fetch)
   const limit = 1000
   let userFollowers = await usersModel.aggregate([{$match:{name}},{$project: {followers: {$slice : ["$followers",fetch,fetch + limit]}}}])
   let followers = await usersModel.find({userId: {$in: userFollowers[0].followers}},{name:1,userId:1,points:1,picture:1})
   followers = followers.sort((a,b)=> b.points - a.points)
   followers = followers.map(f => {
     f.picture = process.env.IMAGEURL + f.picture
     return f
   })
   res.json({data:followers, nextFetch: fetch + limit, isEnd: userFollowers[0].followers.length < limit ? true: false})
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'someting went wrong'})
  }
})

profileRoute.get('/api/p/my/followers/:fetch',validate,async(req,res)=> {
  try {
   let userId = req.session.user.userId
   let {fetch} = req.params
   fetch = parseInt(fetch)
   const limit = 1000
   let userFollowers = await usersModel.aggregate([{$match:{userId}},{$project: {followers: {$slice : ["$followers",fetch,fetch + limit]}}}])
   let followers = await usersModel.find({userId: {$in: userFollowers[0].followers}},{name:1,userId:1,points:1,picture:1})
   followers = followers.sort((a,b)=> b.points - a.points)
   followers = followers.map(f => {
     f.picture = process.env.IMAGEURL + f.picture
     return f
   })
   res.json({data:followers, nextFetch: fetch + limit, isEnd: followers.length < limit ? true:false})
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'someting went wrong'})
  }
})

profileRoute.get('/api/p/my/following/:fetch',validate,async(req,res)=> {
  try {
    let userId = req.session.user.userId
    let {fetch} = req.params
    fetch = parseInt(fetch)
    const limit = 1000
    let userFollowing = await usersModel.aggregate([{$match:{userId}},{$project: {following: {$slice : ["$following",fetch,fetch + limit]}}}])
    let following = await usersModel.find({userId: {$in: userFollowing[0].following}},{name:1,userId:1,points:1,picture:1})
    following = following.sort((a,b)=> b.points - a.points)
    following = following.map(f => {
      f.picture = process.env.IMAGEURL + f.picture
      return f
    })
    res.json({data:following, nextFetch: fetch + limit, isEnd: following.length < limit ? true:false})
  } catch (e) {
    console.log(e);
    res.status(500).json({type:'ERROR',msg:'someting went wrong'})
  }
})


profileRoute.get('/api/p/breakdowns/:name/:int',async(req,res)=> {
    try {
      let loaderCount = parseInt(req.params.int)
      let userName = req.params.name;
      let userBreaks = await usersModel.findOne({name:userName},
        {breakdowns: 1,userId:1,picture:1,points:1})
      if(userBreaks === null) return res.status(400).json({type:'ERROR',msg:'user not found'})
      let songsDigested = userBreaks.breakdowns.map(a => a.songId)
      let songs = await songsModel.find({songId: {$in:songsDigested}},
      {songId:1,songTitle:1,punchlines:1})
      let userId  = req.session.user !== undefined ? req.session.user.userId : false
      let userBreaksObjArray = [];
      for(let i = 0; i < songs.length; i++) {
        for(let j = 0; j < songs[i].punchlines.length; j++) {
          let targetPunch = songs[i].punchlines[j]
           for(let k = 0; k < userBreaks.breakdowns.length; k++) {
             if(userBreaks.breakdowns[k].punchlineId.toString() ===
              targetPunch._id.toString() ) {
                   for(let l = 0; l < targetPunch.breakdowns.length; l++) {
                      if(targetPunch.breakdowns[l].userId === userBreaks.userId)
                       userBreaksObjArray.push({
                         punchIndx: j,
                         songTitle: songs[i].songTitle,
                         songId: songs[i].songId,
                         bar: targetPunch.punchline,
                         artist: targetPunch.artist,
                         breakdown: {
                           breakdown: targetPunch.breakdowns[l].breakdown,
                           name: userName,
                           points: userBreaks.points,
                           picture: process.env.IMAGEURL + userBreaks.picture,
                           id: targetPunch.breakdowns[l]._id,
                           date: targetPunch.breakdowns[l].date,
                           userVote: userId ? getUserVote(targetPunch.breakdowns[l].voters,userId)
                            : false,
                           isThisUser:userId ? req.session.user.userName === userName : false,
                           totalVotes: getTotalVotes(targetPunch.breakdowns[l].voters),
                           brAwards: targetPunch.breakdowns[l].awards
                         }
                       })
                   }
              }
           }
        }
      }
      let isEnd = (loaderCount + 10) >= userBreaksObjArray.length ? true: false;
      let nextFetch = loaderCount + 10;
      userBreaksObjArray = userBreaksObjArray.sort((a,b)=>{
        return new Date(b.breakdown.date).getTime() -
        new Date(a.breakdown.date).getTime()
      })
      userBreaksObjArray = userBreaksObjArray.slice(loaderCount,loaderCount+10)
      res.json({breakdowns:userBreaksObjArray,isEnd,nextFetch})
  } catch (e) {

    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})



profileRoute.get('/api/p/my/breakdowns/:int',validate,async(req,res)=> {
  try {
    let loaderCount = parseInt(req.params.int)
    let userName = req.session.user.name;
    let userBreaks = await usersModel.findOne({name:userName},
      {breakdowns: 1,userId:1,picture:1,points:1})
    if(userBreaks === null) return res.status(400).json({type:'ERROR',msg:'user not found'})
    let songsDigested = userBreaks.breakdowns.map(a => a.songId)
    let songs = await songsModel.find({songId: {$in:songsDigested}},
    {songId:1,songTitle:1,punchlines:1})
    let userId  = req.session.user !== undefined ? req.session.user.userId : false
    let userBreaksObjArray = [];
    for(let i = 0; i < songs.length; i++) {
      for(let j = 0; j < songs[i].punchlines.length; j++) {
        let targetPunch = songs[i].punchlines[j]
         for(let k = 0; k < userBreaks.breakdowns.length; k++) {
           if(userBreaks.breakdowns[k].punchlineId.toString() ===
            targetPunch._id.toString() ) {
                 for(let l = 0; l < targetPunch.breakdowns.length; l++) {
                    if(targetPunch.breakdowns[l].userId === userBreaks.userId)
                     userBreaksObjArray.push({
                       punchIndx: j,
                       songTitle: songs[i].songTitle,
                       songId: songs[i].songId,
                       bar: targetPunch.punchline,
                       artist: targetPunch.artist,
                       breakdown: {
                         breakdown: targetPunch.breakdowns[l].breakdown,
                         name: userName,
                         points: userBreaks.points,
                         picture: process.env.IMAGEURL + userBreaks.picture,
                         id: targetPunch.breakdowns[l]._id,
                         date: targetPunch.breakdowns[l].date,
                         userVote: userId ? getUserVote(targetPunch.breakdowns[l].voters,userId)
                          : false,
                          isThisUser: true,
                         totalVotes: getTotalVotes(targetPunch.breakdowns[l].voters),
                         brAwards: targetPunch.breakdowns[l].awards
                       }
                     })
                 }
            }
         }
      }
    }
    let isEnd = (loaderCount + 10) >= userBreaksObjArray.length ? true: false;
    let nextFetch = loaderCount + 10;
    userBreaksObjArray = userBreaksObjArray.sort((a,b)=>{
      return new Date(b.breakdown.date).getTime() -
      new Date(a.breakdown.date).getTime()
    })
    userBreaksObjArray = userBreaksObjArray.slice(loaderCount,loaderCount+10)
    res.json({breakdowns:userBreaksObjArray,isEnd,nextFetch})
  } catch (e) {
    return res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

function getBattleRecords(battles,userId) {
  let w = d = l = 0;
  for(let i = 0; i < battles.length; i++) {
    let battle = battles[i]
    if(battle.battleOwner.userId === userId) {
      if(battle.battleOwner.userPoints < battle.opponent.userPoints){
        l++
      }else if (battle.battleOwner.userPoints === battle.opponent.userPoints) {
        d++
      }else {
        w++
      }
    }else {
      if(battle.battleOwner.userPoints < battle.opponent.userPoints){
        w++
      }else if (battle.battleOwner.userPoints === battle.opponent.userPoints) {
        d++
      }else {
        l++
      }
    }
  }
  return `${w}-${d}-${l}`
}

function getUserVote(votes,userId) {
  for(let i = 0; i < votes.length; i++) {
    if(votes[i].userId === userId){
      return votes[i].vote
    }
  }
  return false
}
function getTotalVotes(votes) {
  let totalVotes = 0;
  for(let i = 0; i < votes.length; i++) {
    if(votes[i].vote === 'DOWNVOTE') {
      totalVotes--
    }else if(votes[i].vote === 'UPVOTE'){
      totalVotes++
    }
  }
  return totalVotes
}

profileRoute.get('/api/p/songs/:name/:int',async(req,res)=> {
  try {
    let loaderCount = parseInt(req.params.int)
    let songs = await songsModel.find({songArtist: req.params.name}).sort({uploadDate: -1})
    let songsCount = songs.length;
    songs = songs.slice(loaderCount,loaderCount + 9)
    let userId = req.session.user ? req.session.user.userId : false
    songs =  songs.map(song => {
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
      otherArtists: song.otherArtists,
      favourited: song.favourited.length,
      isFav: userId ? song.favourited.some(a => a.userId === userId) : false,
      songCover: process.env.IMAGEURL + song.songCover,
    }
    })
    let isEnd  = (loaderCount + 9 >= songsCount) ? true : false
    let nextFetch = loaderCount + 9
    res.json({songs,nextFetch,isEnd})
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})

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

profileRoute.get('/api/p/top-fans/:name/:fetch',async (req,res)=>{
  try{
   let {name,fetch} = req.params
    fetch = parseInt(fetch)
   const limit = 1000
   let topFansId = await usersModel.aggregate([{$match: {name}},{$project:{topFans: {$slice:["$topFans",fetch,limit]}}}])
   let arr  = topFansId[0].topFans.map(a => {
      return a.userId
   })

   let topFans  = await usersModel.find({userId:{$in: arr}},{name:1,userId:1,picture:1})
   let topFan = [];
   for(let i = 0; i < topFansId[0].topFans.length; i++){
      for(let j = 0; j < topFans.length; j++){
        if(topFansId[0].topFans[i].userId === topFans[j].userId) {
          topFan.push({
            name: topFans[j].name,
            picture: process.env.IMAGEURL + topFans[j].picture,
            points: topFansId[0].topFans[i].points,
            atempts: topFansId[0].topFans[i].atempts
          })
          break;
        }
      }
   }
   let topFansSort = topFan.sort((a,b)=>(b.points - (b.atempts * 2))
   - (a.points - (a.atempts * 2)))
   let data = topFan.map(a => {
     return {
       name: a.name,
       picture: a.picture,
       points: a.points - (a.atempts * 2)
     }
   })
    res.json({data: data, nextFetch: fetch + limit, isEnd: data.length < limit ? true : false})
 }catch(e){

   res.status(500).json({type:'ERROR',msg:'something went wrong'})
 }
})
profileRoute.get('/api/my/profile',validate,async(req,res)=>{
  try {
  let data = await usersModel.findOne({userId: req.session.user.userId});
  if(data === null ) return res.status(400).json({type:'ERROR',msg: 'something went wrong'})
  let battles = await allBattlesModel.find({battleId: {$in: data.battles}})
  battles = battles.filter(a => a.battleOwner.userId && a.opponent.userId && a.battleOwner.userPoints !== 0 && a.opponent.userPoints !== 0)
  let battleRecords = getBattleRecords(battles,data.userId)
  data = {
    name: data.name,
    verified: data.verified,
    topFans: data.topFans.length,
    followers: data.followers.length,
    following: data.following.length,
    points: data.points,
    bio: data.bio,
    picture: process.env.IMAGEURL + data.picture,
    coins: data.userCoins,
    battleRecord: battleRecords
  }
  res.json(data)
 }catch (e) {

    res.status(400).json({type:'ERROR',msg:"something went wrong"})
  }
})

profileRoute.get('/api/my/songs/',validate,async(req,res)=> {

  try {
    let songs = await songsModel.find({songArtist: req.session.user.userName})
    let userId = req.session.user ? req.session.user.userId : false
    songs =  songs.map(song => {
      let hottesBar = findHottestBar(song)
    return  {
      songTitle: song.songTitle,
      songArtist: song.songArtist,
      hottesBar: hottesBar.punchline,
      songId: song.songId,
      barPreview: barPreview(hottesBar.punchline),
      fires: hottesBar.raters.length,
      rating: getRating(song.raters),
      comments: song.comments.length,
      views: song.views.length,
      otherArtists: song.otherArtists,
      isFav: userId ? song.favourited.some(a => a.userId === userId) : false,
      songCover: process.env.IMAGEURL + song.songCover,
    }
    })
    res.json(songs)
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})

  }
})



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
// function isInFavourites(songId,favourites) {
//   if(!Array.isArray(favourites)) {
//     return false;
//   }
//    for(let i = 0; i < favourites.length; i++) {
//      if(favourites[i] === songId) return true;
//    }
//    return false
// }

profileRoute.post('/api/p/follow/:name',validate,async (req,res) => {
  try{
    let sessionUser = req.session.user.userId;
    let  user = await usersModel.findOne({userId:sessionUser});
    let userTf = await usersModel.findOne({name:req.params.name},{userId:1,notifications:1})
       if(user !== null) {
       let alreadyAdded = false;
       for(let i = 0; i < user.following.length; i++) {
         if(user.following[i] === userTf.userId) {
           alreadyAdded = true;
           break;
         }
       }
       if(!alreadyAdded){
         await usersModel.updateOne({userId:sessionUser},
         {$push:{following: userTf.userId}})
         await usersModel.updateOne({userId:userTf.userId},
         {$push:{followers: sessionUser,"notifications.followers":sessionUser}})
         return res.json({type:"SUCCESS",msg:"following"})
     }else {
         await usersModel.updateOne({userId:sessionUser},
         {$pull:{following: userTf.userId}})
         await usersModel.updateOne({userId:userTf.userId},
         {$pull:{followers: sessionUser,"notifications.followers":sessionUser}})
         return res.json({type:"SUCCESS",msg:"unfollowed"})
     }
   }else {
     return res.json({type:"ERROR",msg:"user not found"})
   }

 }catch(e){
   return res.status(500).json({type:'ERROR',msg:'something went wrong'})
 }
})


module.exports = profileRoute;
