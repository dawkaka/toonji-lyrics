const express = require('express');
lyricsRouter = express.Router();
const songsModel = require('../../database/mongooseSchemas/songsSchema')
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const validate = require('../validate');

lyricsRouter.post('/api/lyrics/viewed/:lyricsId',async(req,res)=>{
      try {
          await songsModel.updateOne({songId: req.params.lyricsId},
          {$push: {views: new Date()}});

      } catch (e) {
        return res.status(400).json({type:'ERROR',msg:'something went wrong'})
      }
    res.json({type:"SUCCESS",msg:"view counted"})
})

lyricsRouter.post('/api/lyrics/rate/:numberOfStars/:lyricsId',validate,async(req,res)=>{
      try {
            let check = await songsModel.findOne({songId: req.params.lyricsId},
              {raters:1})
            if(check !== null){
               if(check.raters.some(a => a.userId === req.session.user.userId)){
                 return res.status(403).json({type:'ERROR',msg:'this action can not be performed twice'})
               }
            }else {
              return res.status(500).json({type:'ERROR',msg:'lyrics not found'})
            }
            let rating = parseInt(req.params.numberOfStars)
           let song = await songsModel.updateOne({songId: req.params.lyricsId},
           {$push:{raters: {userId:req.session.user.userId,
                            rate: rating,
                            dateRated: new Date()
            }}})
           res.json(song)
      } catch (e) {
        res.status(500).json({type:'ERROR',msg:'something went wrong'})
      }
})



lyricsRouter.post('/api/lyrics/fire/:songId/:barId',validate,async(req,res)=>{
  try {
      let rate = await songsModel.findOne({songId: req.params.songId})
      if(rate === null) return res.status(400).json({type:'ERROR',msg:"lyrics not found"})
      let punchId = rate.punchlines[req.params.barId]._id;
      let alreadyRated = rate.punchlines[req.params.barId].raters.some(a => {
        return a.userId === req.session.user.userId
      })

      let bar = rate.punchlines[req.params.barId]

      if(!alreadyRated){
      await songsModel.updateOne(
      {songId:req.params.songId, "punchlines._id":punchId},
      {$push:{"punchlines.$.raters": {
        userId:req.session.user.userId,
        date: new Date()
      }}})
      let artist = await usersModel.findOne({name:bar.artist},{name:1,points:1})
      if(artist !== null) {
        await usersModel.updateOne({name:bar.artist},
          {$set:{points: artist.points + 1}})
      }
      let barObj = {
        punchline: bar.punchline,
        artist: bar.artist,
        punchlineId: parseInt(req.params.barId),
        songId: req.params.songId,
        fires: bar.raters.length + 1
   }
     res.json({type:'SUCCESS',msg:'bars *_*'})

    }else {
      let barObj2 = {
        punchline: bar.punchline,
        artist: bar.artist,
        punchlineId: parseInt(req.params.barId),
        songId: req.params.songId,
        fires: bar.raters.length + 1
      }
      await songsModel.updateOne(
      {songId:req.params.songId, "punchlines._id":punchId},
      {$pull:{"punchlines.$.raters":{ userId: req.session.user.userId}}})
      let artist = await usersModel.findOne({name:bar.artist},{name:1,points:1})
      if(artist !== null) {
        await usersModel.updateOne({name:bar.artist},
          {$set:{points: artist.points - 1}})
      }

      res.json({type:'SUCCESS',msg:'boo *_*'})
    }

    } catch (e) {
     res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

module.exports = lyricsRouter
