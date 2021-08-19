const express = require('express');
const commentsRouter = express.Router()
const validate = require('../validate');
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const songsModel = require('../../database/mongooseSchemas/songsSchema')

commentsRouter.get('/api/comments/:songId/:int',async(req,res)=> {
  try{
  const loadCount = parseInt(req.params.int)
  let song = await songsModel.findOne({songId: req.params.songId},{comments:1})
  if(song === null) return res.json({type:'ERROR',msg:'song comments not found'})
  let commentCount = song.comments.length;
   songDotComments = song.comments.sort((a,b)=> getLikes(b.likes)-getLikes(a.likes))
  let comments = song.comments.slice(loadCount,loadCount + 15);
  let commentators = [];
  for(let i = 0; i < comments.length; i++){
    commentators.push(comments[i].userId)
  }
  let commentsUsers = await usersModel.find({userId: {$in:commentators}},{name:1,userId:1,picture:1,points:1})
  let commentObj = {}
  for(let i = 0; i < commentsUsers.length; i++){
    if(commentObj[`${commentsUsers[i].userId}`] === undefined){
      commentObj[`${commentsUsers[i].userId}`] = {}
      commentObj[`${commentsUsers[i].userId}`].name = commentsUsers[i].name;
      commentObj[`${commentsUsers[i].userId}`].picture = commentsUsers[i].picture;
      commentObj[`${commentsUsers[i].userId}`].points = commentsUsers[i].points;

    }
  }

  let userId = req.session.user === undefined ? false: req.session.user.userId
  let nextFetch = loadCount + comments.length;
  comments = comments.map(a => {
    if(commentObj[a.userId] !== undefined){
    let obj = {
      comment: a.commentText,
      date: a.date,
      name: commentObj[`${a.userId}`].name,
      picture: commentObj[`${a.userId}`].picture,
      points: numberToKOrM(commentObj[`${a.userId}`].points),
      likes: getLikes(a.likes),
      id: a._id,
      isThisUser: userId ? req.session.user.userName === commentObj[`${a.userId}`].name: false,
      liked: userId ? getUserReaction(a.likes,userId) : false,
      commAwards: a.awards
    }
    return a = obj
  }else {
    return a
  }
  }).filter(a => a.name !== "" && a.name !== undefined)

  let isEnd = false
 if(loadCount + 15 > commentCount){
   isEnd = true;
 }
  res.json({comments,isEnd,nextFetch})
}catch(e) {

  res.json({type:'ERROR',msg: 'something went wrong'})
}
})

function getLikes(likesArray) {
  let total = 0;
  for(let i = 0; i < likesArray.length; i++) {
    if(likesArray[i].reaction){
    if(likesArray[i].reaction === "LIKED"){
      total++
    }else {
      total--
    }
  }
}
  return total
}

function getUserReaction(likesArray,userId){
  let reaction;
  for(let i = 0; i < likesArray.length; i++) {
    if(likesArray[i].userId === userId) {
      reaction = likesArray[i].reaction
      break;
    }
  }
  return reaction
}

commentsRouter.post('/api/comment/:songId',validate, async (req,res)=>{
  try {
    if(req.body.comment.length > 226) {
      res.json({type:'ERROR',msg:"comment can't be longer than 226 characters"})
    }
    let song = await songsModel.findOne({songId: req.params.songId});
    let user = req.session.user.userId;
    if(song !== null){
      if(song.comments.length >= 500) {
        return res.json({type:'ERROR',msg:'there are too many of those already'})
      }
      let isDuplicate  = song.comments.some(a => a.userId === user &&
         req.body.comment.toLowerCase() === a.commentText.toLowerCase())
      if(!isDuplicate){
        let date = new Date;
      await songsModel.updateOne({songId: req.params.songId},
          {$push: {comments: {
           userId: user,
           date: date,
           commentText: req.body.comment,
           likes: []
          }}})
    let songComments = await songsModel.findOne({songId:req.params.songId},
      {comments:1})

    let userComment = songComments.comments.filter(a =>{
      return a.userId === req.session.user.userId && a.commentText === req.body.comment
    })
    let commUser = await usersModel.findOne({userId: req.session.user.userId},{name:1,points:1,picture:1})
    let userId = req.session.user.userId
  userComment = userComment.map(a => {
      return {
        name: commUser.name,
        picture: commUser.picture,
        comment: a.commentText,
        date: a.date,
        likes: a.likes.length,
        id: a._id.toString(),
        isThisUser: userId ? req.session.user.userName === commUser.name: false,
        points: commUser.points,
        commAwards: a.awards
      }
    })
      return res.json({type:'SUCCESS',msg:'comment sent',userComment})
    }else {
      res.json({type:'ERROR',msg:'duplicate comment'})
    }
    }else {
     return res.json({type:'ERROR',msg:'song not found'})
    }
  } catch (e) {

    res.json({type:'ERROR',msg:'something went wrong'})
  }
})

commentsRouter.post('/api/comment-reactions/:songId/:commentId/:reaction',validate,async (req,res)=>{
     try {
       let {songId,commentId,reaction} = req.params;
       if(reaction !== "LIKED" && reaction !== "DISLIKED") return res.json({type:'ERROR',msg:'invalid reaction'})
       let userId = req.session.user.userId;
       if(songId === undefined || commentId === undefined || reaction === undefined){
         return res.json({type:'ERROR',msg:'something went wrong'})
       }
       let comment = await songsModel.findOne({songId,"comments._id":commentId},{userId:1,comments:1})
       if(!comment) return res.json({type:'ERROR',msg:'song not found'})
       let comm;
       for(let i = 0; i < comment.comments.length; i++) {
          if(comment.comments[i]._id.toString() === commentId) {
            comm = comment.comments[i].likes;
            commUser = comment.comments[i].userId
            break;
          }
       }
       if(comm === undefined) return res.json({type:'ERROR',mgs:'comment not found'})
       if(comm.some(a => a.userId === userId)) {
         let remove = false;
         for(let i = 0; i < comm.length; i++) {
           if(comm[i].userId === userId) {
             if(comm[i].reaction === reaction){
               comm[i] = undefined
               remove = true
             }else {
               comm[i].reaction = reaction
               remove = false
             };
           }
         }
         if(remove) {
           comm = comm.filter(a => a != undefined && null)
         }
          await songsModel.updateOne({songId,"comments._id":commentId},
                                    {$set:{"comments.$.likes": comm}})

          if(remove) return res.json({type:'SUCCESS',msg: "undo!"})
          return res.json({type:'SUCCESS',msg: reaction.toLowerCase()})
       }else {
         await songsModel.updateOne({songId,"comments._id":commentId},
                                       {$push:{"comments.$.likes":
                                       {userId,reaction}}})
           if(reaction === "LIKED"){
              await usersModel.updateOne({userId: commUser},
                 {$push:{"notifications.likes":{userId,songId,commentId}}})
            }
         return res.json({type:'SUCCESS',msg:reaction.toLowerCase()})
       }
     } catch (e) {

       return res.json({type:'ERROR',msg:'something went wrong'})
     }
})

commentsRouter.post('/api/delete/comment/:songId/:commentId',validate,async(req,res)=> {
     try {
       let {songId,commentId}  = req.params;
       let comments = await songsModel.findOne({songId},{comments:1})
       if(comments !== null){
       let comm;
       for(let i = 0; i < comments.comments.length; i++) {
          if(comments.comments[i]._id.toString() === commentId) {
            comm = comments.comments[i];
            break;
          }
       }
        if(comm.userId === undefined) {
          return res.json({type:'ERROR',msg:'deleted already'})
        }
       if(comm.userId === req.session.user.userId){
        let re = await songsModel.updateOne({songId},
         {$pull:{comments: {_id:commentId}}})
         res.json({type:'SUCCESS',msg:'comment deleted'})
       }else {
         res.json({type:'ERROR',msg:"can't perform this action"})
       }

     } else {
       res.json({type:'ERROR',msg:'song not found'})
     }
   }catch (e) {

       res.json({type:'ERROR',msg:'something went wrong'})
     }
})

commentsRouter.post("/api/award-comment",validate,async(req,res)=> {
  try {
      let {awardsGiven,songId,commentId} = req.body
      if(!awardsGiven || !songId || !commentId) return res.json({type:'ERROR',msg: "missing some request bodies"})
      const userId = req.session.user.userId
      awardsGiven = awardsGiven.filter(a => {
        return ["platinum","diamond","gold","silver","bronze","copper"].includes(a)
      })
      if(awardsGiven.length < 1) return res.json({type:'ERROR',msg:'no valid award selected'})
      const numOfCoins = getNumberOfCoins(awardsGiven)
      let userCoins = await usersModel.findOne({userId},{userCoins:1})
      userCoins = userCoins.userCoins
      if(userCoins !== undefined && userCoins < numOfCoins) {
        return res.json({type:'ERROR',msg:'more coins required'})
      }
      const comments = await songsModel.findOne({songId},{comments:1})
      if(comments == null) return res.json({type:'ERROR', msg:'something went wrong'})
      let comm;
      for(let i = 0; i < comments.comments.length; i++) {
         if(comments.comments[i]._id.toString() === commentId) {
           comm = comments.comments[i];
           break;
         }
      }
      const commUserId = comm.userId
      if(userId === commUserId) return res.json({type:'ERROR',msg:"can't perform this actions"})
      //transfer coins to the user who's breakdown was awarded
      const transferCoinsTo = await usersModel.findOne({userId: commUserId},{userCoins:1})
      if(transferCoinsTo === null) return res.json({type:'ERROR',msg:'something went wrong'})
      //add user's prevous coins and the num of coins awarded
      let numToTransfer = !isNaN(transferCoinsTo.userCoins) ?  transferCoinsTo.userCoins + numOfCoins : numOfCoins
      let awardNotifOjb = {userId, songId, type: "comment",
                                brORcommentId: commentId, award: awardsGiven.join(",")}
      const hasTransfered = await usersModel.updateOne({userId:commUserId},
        {$set:{userCoins: numToTransfer},$push :{"notifications.awards":awardNotifOjb}})
        if(!hasTransfered) return res.json({type:'ERROR',msg:'something went wrong'})
      //subtracting coins from user who awarded the breakdown
      const transferCoinsFrom = await usersModel.updateOne({userId},
        {$set:{userCoins: userCoins - numOfCoins}})
        if (transferCoinsFrom.nModified == 0) {
          return res.json({type:'ERROR',msg:'something went wrong'})
        }
      let awards = comm.awards
      for(let j = 0; j < awardsGiven.length; j++) {
        awards[`${awardsGiven[j]}`]++
      }
      await songsModel.updateOne({songId,"comments._id":commentId},
                                           {$set:{"comments.$.awards":awards}})
      res.json({type:'SUCCESS',msg:'comment awarded'})
  } catch (e) {

    res.json({type:'ERROR',msg: "something went wrong"})
  }
})

function getNumberOfCoins(arr) {
  let total = 0;
  awards = {
    platinum: 5000,
    diamond: 1000,
    gold: 500,
    silver: 70,
    bronze: 30,
    copper: 5
  }
  for (i = 0; i < arr.length; i++) {
    total += awards[`${arr[i]}`]
  }
  return total
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
module.exports = commentsRouter;
