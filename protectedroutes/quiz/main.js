const express = require('express');
const quizRouter = express.Router();
const validate = require('../validate');
const usersModel = require('../../database/mongooseSchemas/usersSchema');
const songsModel = require('../../database/mongooseSchemas/songsSchema');
const battlesModel = require('../../database/mongooseSchemas/battleSchema')
const allBattlesModel = require('../../database/mongooseSchemas/allBattlesSchema')

quizRouter.get('/api/top-fan-quiz/:profileId',validate,async(req,res)=>{
try {
 let songs = await songsModel.find({songArtist: req.params.profileId})
 let user = await usersModel.findOne({userId: req.session.user.userId},{userCoins:1})
 if(!user)return res.json({type:'ERROR',msg:'we are not able to identify you'})
 if(user.userCoins < 50) return res.json({type:'ERROR',msg:'more coins required'})
 if(!songs.length){
   res.json({type: "Error", msg:"No songs from this artist"})
 }else {
 let generatedQuestions = await generateQuestions(songs)
 let questionsToken = generateID()
 req.session.user.questionsToken = questionsToken;
 res.cookie('token_id',questionsToken,{signed: true})
 await usersModel.updateOne({userId: req.session.user.userId},{$set:{userCoins: user.userCoins - 50}})
 return res.json(generatedQuestions)
}
} catch (e) {
  return res.json({type:'ERROR',msg:'something went wrong'})
}
})

quizRouter.post('/api/top-fan/:name/:points',validate,async (req,res)=>{
     try {
       let qToken = req.session.user.questionsToken
       if(qToken !== req.signedCookies.token_id) {
         return res.json({type:'ERROR', msg:'no questions generated for this user'})
       }
       let {name,points} = req.params;
       points = parseInt(points) || 0
       let userId = req.session.user.userId
       let user = await usersModel.findOne({name})
       if(user === null) return res.json({type:'ERROR',msg:'artist not found'})
       let alreadyInTopFans = user.topFans.some(a => a.userId === userId)
       let prevAtempts = 0
       for(let i = 0; i < user.topFans.length; i++){
          if(user.topFans[i].userId === userId){
            prevAtempts = user.topFans[i].atempts
            break;
          }
        }
       if(!alreadyInTopFans) {
         let insertResult = await usersModel.updateOne({name},
           {$push: {topFans: {
             userId,
             atempts: 10,
             points
           }}})

           return res.json({type:'SUCCESS',msg:'points submited'})
       }else {
         let prevPoints = 0;
         for(let i = 0; i < user.topFans.length; i++){
            if(user.topFans[i].userId === userId){
              prevPoints = user.topFans[i].points
              break;
            }
         }
         let insertResult = await usersModel.updateOne({name,"topFans.userId":userId},
           {$set: {
             "topFans.$.points": prevPoints + points,
             "topFans.$.atempts": prevAtempts + 10}})
             req.session.user.questionsToken = ""
           return res.json({type:'SUCCESS',msg:'points submited'})
       }
     } catch (e) {

       res.json({type:'ERROR',msg:'something went wrong'})
     }
})



quizRouter.get("/api/battle/battle-link",validate, async(req,res) => {
      try {
        const userId = req.session.user.userId
        const user = await usersModel.findOne({userId},{userCoins:1,userId: 1})
        if(!user) return res.json({type:'ERROR',msg:'user not found'})
        if(user.userCoins - 100 < 0) return res.json({type:'ERROR',msg:"more coins required"})
        const linkId = generateID(15)
        await usersModel.updateOne({userId},{$set:{userCoins: user.userCoins - 100}})
        const battle = new battlesModel({
          battleId: linkId,
          battleOwner: user.userId,
          createdDate: new Date(),
          numConnected: [],
          battleStarted: false
        })
        await battle.save()
        res.json({battleId: linkId})
      } catch (e) {

        res.json({type:'ERROR',msg:'something went wrong'})
      }
})


quizRouter.get("/api/battle/:battleId",validate,async(req,res)=> {
     try {
       const {battleId} = req.params
       const userId = req.session.user.userId
       const isValidId = await battlesModel.findOne({battleId})
       if(!isValidId) return res.json({type:'ERROR',msg:'invalid battle link'})
       if(isValidId.numConnected.length > 0 && userId !== isValidId.battleOwner){
         return res.json({type:'ERROR',msg:"you can't join this battle link atm"})
       }
       return res.json({type:"SUCCESS",msg:"here"})
     } catch (e) {

       res.status(400).json({type:'ERROR',msg:'something went wrong'})
     }
})

quizRouter.get("/api/battle-records/:userName", async (req,res)=> {
  try {
    const userName = req.params.userName
    const user = await usersModel.findOne({name: userName},{battles:1, userId: 1})
    const battles = await allBattlesModel.find({battleId: {$in: user.battles}})
    let opponents = [];
    opponents.push(user.userId)
    for(let i = 0; i < battles.length; i++) {
       if(battles[i].battleOwner.userId !== user.userId && !opponents.some(a => a === battles[i].battleOwner.userId)) {
         opponents.push(battles[i].battleOwner.userId)
       }
       if(battles[i].opponent.userId !== user.userId && !opponents.some(a => a === battles[i].opponent.userId)) {
         opponents.push(battles[i].opponent.userId)
       }
    }
    const opponentsNames = await usersModel.find({userId: {$in: opponents}},{name:1,userId:1,picture:1})
    let userMap = {};
    for(let i = 0; i < opponentsNames.length; i++) {
      if(userMap[`${opponentsNames[i].userId}`] === undefined) {
        userMap[`${opponentsNames[i].userId}`] = {
          name: opponentsNames[i].name,
          picture: opponentsNames[i].picture
        }
      }
    }

    let battlesMap = battles.map(a => {
      return  {
        userOne: {
          name: userMap[`${a.battleOwner.userId}`].name,
          points: a.battleOwner.userPoints,
          picture: userMap[`${a.battleOwner.userId}`].picture
        },
        userTwo: {
          name: userMap[`${a.opponent.userId}`].name,
          points: a.opponent.userPoints,
          picture: userMap[`${a.opponent.userId}`].picture
        }
      }
    }).filter(a => a.userOne.name && a.userTwo.name && a.userOne.points !== 0 && a.userTwo.points !== 0)
    res.json(battlesMap)
  } catch (e) {
    res.json({type:'ERROR',msg:'something went wrong'})
  }
})


quizRouter.get("/api/my/battle-records",validate,async (req,res)=> {
  try {
    const userName = req.session.user.name
    const user = await usersModel.findOne({name: userName},{battles:1, userId: 1})
    const battles = await allBattlesModel.find({battleId: {$in: user.battles}})
    let opponents = [];
    opponents.push(user.userId)
    for(let i = 0; i < battles.length; i++) {
       if(battles[i].battleOwner.userId !== user.userId && !opponents.some(a => a === battles[i].battleOwner.userId)) {
         opponents.push(battles[i].battleOwner.userId)
       }
       if(battles[i].opponent.userId !== user.userId && !opponents.some(a => a === battles[i].opponent.userId)) {
         opponents.push(battles[i].opponent.userId)
       }
    }
    const opponentsNames = await usersModel.find({userId: {$in: opponents}},{name:1,userId:1,picture:1})
    let userMap = {};
    for(let i = 0; i < opponentsNames.length; i++) {
      if(userMap[`${opponentsNames[i].userId}`] === undefined) {
        userMap[`${opponentsNames[i].userId}`] = {
          name:opponentsNames[i].name,
          picture:opponentsNames[i].picture
        }
      }
    }

    let battlesMap = battles.map(a => {
      return  {
        userOne: {
          name: userMap[`${a.battleOwner.userId}`].name,
          points: a.battleOwner.userPoints,
          picture: userMap[`${a.battleOwner.userId}`].picture
        },
        userTwo: {
          name: userMap[`${a.opponent.userId}`].name,
          points: a.opponent.userPoints,
          picture: userMap[`${a.opponent.userId}`].picture
        }
      }
    }).filter(a => a.userOne.name && a.userTwo.name && a.userOne.points !== 0 && a.userTwo.points !== 0)
    res.json(battlesMap)
  } catch (e) {
    res.json({type:'ERROR',msg:'something went wrong'})
  }
})


function generateQuestions(songs) {
  let generatedQuestions = []
  let gLength = 0;
  for(let i = 0; gLength < 10 ; i++) {
    let randomSong = songs[Math.floor(Math.random() * songs.length)]
    const qTitles = [`What ${randomSong.songArtist} song was this said ?`,
      'Complete the lyrics'];
    if(randomSong.otherArtists.trim() !== "" && randomSong.otherArtists !== undefined) {
      qTitles.push(`Which artist said this on the Ksi song ${randomSong.songTitle} ?`)
    }
    let currentQuestion = qTitles[Math.floor(Math.random() * qTitles.length)];
    let randomPunchline = randomSong.punchlines[Math.floor(Math.random() * randomSong.punchlines.length)]

    switch (currentQuestion.substr(0,4)) {
      case 'What':
      let queWhat = randomPunchline.punchline.replace(randomPunchline.songTitle,'*_*')
          generatedQuestions.push({
            questionTitle: currentQuestion,
            questionText: queWhat,
            questionAnswer: randomSong.songTitle
          })
          gLength++
        break;
      case 'Comp':
        let punch = randomPunchline.punchline
        punch = punch.replace(/\n/g," ");
        punch = punch.replace(/\r/g," ");
         let words = punch.split(" ").filter(a => a !== '')
         if(words.length < 15) continue
         words = words.slice(words.length - 15,words.length);
         let start = Math.floor(Math.random() * (words.length - 5)) + 1
         let end = start + 4 ;
         let cutString = [];
         for(let i = start; i < end; i++){
           cutString.push(words[i])
            words[i] = ".";
         }
          generatedQuestions.push({
            questionTitle: currentQuestion,
            questionText: words.join(" "),
            questionAnswer: cutString.join(" ")
          })
          gLength++
        break;
      default :
      let queWhic = randomPunchline.punchline.replace(randomPunchline.artist,'*_*')
          generatedQuestions.push({
            questionTitle: currentQuestion,
            questionText: queWhic,
            questionAnswer: randomPunchline.artist
          })
          gLength++
          break;
    }
  }

  return generatedQuestions
}

function generateID(n = 11) {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < n; i++) {
    str += chars[Math.floor((Math.random() * (chars.length)))];
  }
  return str
}
module.exports = quizRouter;
