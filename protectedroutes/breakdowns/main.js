const express = require('express');
const breakdownsRouter = express.Router()
const songsModel = require('../../database/mongooseSchemas/songsSchema')
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const validate = require('../validate');


breakdownsRouter.get('/api/breakdowns/:songId/:barIndx',async(req,res)=>{
  try{
   let {songId,barIndx } = req.params;
   let bars = await songsModel.findOne({songId},{punchlines:1})
   if(bars !== null){
     let indx = parseInt(barIndx);
     let digesters = [];
     for(let i = 0; i < bars.punchlines[indx].breakdowns.length; i++){
        digesters.push(bars.punchlines[indx].breakdowns[i].userId)
     }
     let digests = await usersModel.find({userId: {$in:digesters}},{name:1,userId:1,picture:1,points:1})
     let breakdownObj = {}
     for(let i = 0; i < digests.length; i++){
       if(breakdownObj[`${digests[i].userId}`] === undefined){
         breakdownObj[`${digests[i].userId}`] =  {};
         breakdownObj[`${digests[i].userId}`].name = digests[i].name;
         breakdownObj[`${digests[i].userId}`].picture = process.env.IMAGEURL + digests[i].picture;
         breakdownObj[`${digests[i].userId}`].points = digests[i].points;

       }
     }

     let userId = req.session.user ? req.session.user.userId : false
     let breakdowns = bars.punchlines[indx].breakdowns.map(b => {
       if(breakdownObj[b.userId] !== undefined){
         let obj = {
           name: breakdownObj[b.userId].name,
           picture: process.env.IMAGEURL + breakdownObj[b.userId].picture,
           points: numberToKOrM(breakdownObj[b.userId].points),
           id: b._id,
           breakdown: b.breakdown,
           date: b.date,
           userVote: userId ? getUserVote(b.voters,userId) : false,
           isThisUser: userId ?
          req.session.user.userName === breakdownObj[`${b.userId}`].name: false,
           totalVotes: getTotalVotes(b.voters),
           brAwards: b.awards
         }
         return obj
       }else {
         return b
       }
     }).filter(a => a.name !== '' && a.name !== undefined)
     breakdowns = breakdowns.sort((a,b)=> {
       return b.totalVotes - a.totalVotes
     })
     return res.json(breakdowns)
   }else {
     res.status(400).json({type:'ERROR',msg:'song not found'})
   }
 }catch(e) {
   res.status(500).json({type:'ERROR',msg:'something went wrong'})
 }
})

breakdownsRouter.post('/api/breakdown/:songId/:barIndx',validate,async (req,res)=>{
   try{
      const breakdown = req.body.breakdown.toString().trim()

     if(breakdown.length > 500) {
       res.status(400).json({type:'ERROR',msg:"breakdown can't be longer than 500 characters"})
     }
     let user = req.session.user.userId
     let {songId,barIndx} = req.params;
     barIndx = parseInt(barIndx)
     let song = await songsModel.findOne({songId})
       if(song !== null){
         let isDuplicate  = song.punchlines[barIndx].breakdowns.some(a => breakdown.toLowerCase()
         === a.breakdown.toLowerCase())
         if(!isDuplicate){
             if(song.punchlines[barIndx].breakdowns.length > 10){
               return  res.status(400).json({type:'ERROR',msg:"can't add more breakdowns at this time"})
             }
           let punchId = song.punchlines[barIndx]._id;
          let result = await songsModel.updateOne(
          {songId:req.params.songId, "punchlines._id":punchId},
          {$push:{"punchlines.$.breakdowns": {
            userId: user,
            date: new Date,
            breakdown: breakdown,
            voters: [],
            awards: {
              platinum: 0,
              diamond: 0,
              gold: 0,
              silver: 0,
              bronze: 0,
              copper: 0
            }
          }}})
         let userToUpdate = await usersModel.findOne({userId:user},{userId:1,breakdowns:1})
         if(userToUpdate !== null) {
           let atempted = false
           for(let i = 0; i < userToUpdate.breakdowns.length; i++){
             if(userToUpdate.breakdowns[i].punchlineId.toString() === punchId.toString()
             && userToUpdate.breakdowns[i].songId === songId) {
               atempted = true
             }
           }

           if(!atempted){
           await usersModel.updateOne({userId: user},
           {$push:{breakdowns: {
             songId: songId,
             punchlineId: punchId,
           }}})
         }
         }
         return res.json({type:'SUCCESS',msg:'breakdown sent'})
       }else {
         return res.status(400).json({type:'ERROR',msg:'no duplicate breakdowns'})
       }
     }else {
       return res.status(400).json({type:'ERROR',msg:'lyrics not found'})
     }
   }catch(e){
     res.status(500).json({type:'ERROR',msg:'something went wrong'})
   }
})

breakdownsRouter.post('/api/breakdown-vote/:songId/:barIndx/:breakdownId/:vote',
validate,async (req,res)=>{
  try {
     let {songId, barIndx,vote,breakdownId} = req.params;
      barIndx = parseInt(barIndx);
     if(vote !== "UPVOTE" && vote != "DOWNVOTE") return res.status(400).json({type:'ERROR',msg:'invalid vote type'})
     let userId = req.session.user.userId;
     let song = await songsModel.findOne({songId},{punchlines: 1})
     if(song !== null) {
       let punchId = song.punchlines[barIndx]._id;
       let breakId = breakdownId
       // song.punchlines[barIndx].breakdowns[breakdownId]._id
       let searchBreakdowns = song.punchlines[barIndx].breakdowns
       let targetBreakDown  = getBreakdown(searchBreakdowns,breakId)
       let alreadyRated = targetBreakDown.voters.some(a => {
         return a.userId ===  userId && a.vote === vote
       })
       if(!alreadyRated){
         let userWhoBrokeDown = '';
         let breakdowns = song.punchlines[barIndx].breakdowns
         for(let i = 0; i < breakdowns.length; i++){
           if(breakdowns[i]._id.toString() === breakId){
             userWhoBrokeDown = breakdowns[i].userId
             if(breakdowns[i].voters.some(a => a.userId === userId)){
               for(let j = 0; j < breakdowns[i].voters.length; j++) {
                 if(breakdowns[i].voters[j].userId === userId) {
                   breakdowns[i].voters[j].vote = vote
                 }
               }
             }else {
               breakdowns[i].voters.push({
                 userId,
                 vote
               })
             }
             break;
           }
         }
         breakdowns  = breakdowns.filter(a => {
           let checkVoters = getTotalVotes(a.voters)
           return checkVoters > -9
         })
         await songsModel.updateOne(
         {songId, "punchlines._id":punchId},
         {$set:{"punchlines.$.breakdowns": breakdowns}})

         let user = await usersModel.findOne({userId:userWhoBrokeDown},
           {name:1,points:1})
         if(user !== null) {
          if(vote === 'UPVOTE') {
          await usersModel.updateOne({userId:userWhoBrokeDown},
                {$set:{points: user.points + 1},
                 $push:{"notifications.upvotes":{userId, songId,
                  punchlineId: punchId, brId: breakdownId}}})
          }else if(vote === 'DOWNVOTE') {
           await usersModel.updateOne({userId: userWhoBrokeDown},
                {$set:{points: user.points - 1}})
          }
        }
       res.json({type:'SUCCESS',msg:`${vote}`})
     }else {
       return res.status(403).json({type:'ERROR',msg:'no double votes'})
     }
     }else {
       res.status(400).json({type:'ERROR',msg:'song not found'})
     }
   } catch (e) {

     res.status(500).json({type:'ERROR',msg:'something went wrong'})
   }
})


breakdownsRouter.post('/api/delete/breakdown/:sId/:pId/:bId',validate,
async(req,res)=> {
  try {
    let {sId,pId,bId} = req.params;
     pId = parseInt(pId);
    let userId = req.session.user.userId;
    let song = await songsModel.findOne({songId:sId})
    if(song !== null) {
      let punchId = song.punchlines[pId]._id;
      let searchBreakdowns = song.punchlines[pId].breakdowns
      let targetBreakDown  = getBreakdown(searchBreakdowns,bId)
      if(targetBreakDown.userId === req.session.user.userId){
      await songsModel.updateOne({songId:sId,"punchlines._id":punchId},
          {$pull: {"punchlines.$.breakdowns": {_id:bId}}})
          res.json({type:'SUCCESS',msg:'breakdown deleted'})
      }else {
        res.status(401).json({type:'ERROR',msg:"can't perform this action"})
      }
    }else {
      res.status(400).json({type:'ERROR',msg:'song not found'})
    }
  } catch (e) {

    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

breakdownsRouter.post("/api/award-breakdown",validate,async(req,res)=> {
  try {
    let {songId,punchId,brId,awardsGiven} = req.body
    const userId = req.session.user.userId
    let userCoins = await usersModel.findOne({userId},{userCoins:1})
    userCoins = userCoins.userCoins;
    awardsGiven = awardsGiven.filter(a => {
      return ["platinum","diamond","gold","silver","bronze","copper"].includes(a)
    })
    if(awardsGiven.length < 1) return res.status(400).json({type:'ERROR',msg:'no valid award selected'})
    const numOfCoins = getNumberOfCoins(awardsGiven)
    if(userCoins !== undefined && userCoins < numOfCoins) {
      return res.status(401).json({type:'ERROR',msg:'more coins required'})
    }
    const song = await songsModel.findOne({songId})
    if(song === null) {
      return res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
    let punch;
    for(let i = 0; i < song.punchlines.length; i++) {
      if(i === parseInt(punchId)) {
        punch = song.punchlines[i]
        break;
      }
    }
    if(!punch) return res.status(400).json({type:'ERROR',msg:'something went wrong'})
    let breakdown;
    for(let i = 0; i < punch.breakdowns.length; i++){
      if (punch.breakdowns[i]._id.toString() === brId) {
        breakdown = punch.breakdowns[i]
      }
    }
    if(!breakdown) return res.status(400).json({type:'ERROR',msg:'something went wrong'})
    const brUserId = breakdown.userId
    if(userId === brUserId) return res.status(401).json({type:'ERROR',msg:"can't perform this actions"})

    let awardsNotifObj = {userId, songId,punchlineId: punch._id, type: "breakdown",
                         brORcommentId: brId, award: awardsGiven.join(",")}
    let breakdowns = punch.breakdowns;
        for(let i = 0; i < breakdowns.length; i++) {
          if (breakdowns[i]._id.toString() === brId) {
            for(let j = 0; j < awardsGiven.length; j++) {
              breakdowns[i].awards[`${awardsGiven[j]}`]++
            }
          }
        }

         const session = await usersModel.startSession()
         try {
           await session.withTransaction(async()=> {
             await usersModel.updateOne({userId},
              {$inc:{userCoins:  -1 * numOfCoins}},{session});

             await usersModel.updateOne({userId:brUserId},
               {$inc:{userCoins: numOfCoins},
               $push:{"notifications.awards":awardsNotifObj}},{session});

             await songsModel.updateOne({songId,"punchlines._id":punch._id},
               {$set:{"punchlines.$.breakdowns": breakdowns}},{session})
           })
         }catch(e){
           return res.status(500).json({type:'ERROR',msg:"award breakdown not successful"})
         } finally {
            session.endSession()
         }
        res.json({type:'SUCCESS',msg:"breakdown awarded"})

      } catch (e) {
        console.log(e);
        res.status(500).json({type:'ERROR',msg:'something went wrong'})
      }
    })

breakdownsRouter.post('/api/edit-breakdown/:songId/:pId/:bId',validate,async(req,res)=> {
  try {
    let {songId,pId,bId} = req.params;
    pId = parseInt(pId)
    let newBreakdown = req.body.newBreakdown
    let song = await songsModel.findOne({songId},{punchlines:1})
    if(song) {
       let punchId = song.punchlines[pId]._id;
       let searchBreakdowns = song.punchlines[pId].breakdowns
       let targetBreakDown  = getBreakdown(searchBreakdowns,bId)
       if(targetBreakDown.userId === req.session.user.userId){
         for(let i = 0; i < searchBreakdowns.length; i++) {
           if(searchBreakdowns[i]._id.toString() === bId) {
             searchBreakdowns[i].breakdown = newBreakdown
           }
         }
       await songsModel.updateOne({songId,"punchlines._id":punchId},
           {$set: {"punchlines.$.breakdowns": searchBreakdowns}})
           res.json({type:'SUCCESS',msg:'breakdown updated'})
       }else {
         res.status(401).json({type:'ERROR',msg:"can't perform this action"})
       }
    }else {
      return res.status(400).json({type:'ERROR',msg: 'song not found'})
    }
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

function getBreakdown(breakdowns,id) {
  for(let i = 0; i < breakdowns.length; i++){
    if(breakdowns[i]._id.toString() === id.toString()) {
      return breakdowns[i]
    }
  }
}

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
module.exports = breakdownsRouter;
