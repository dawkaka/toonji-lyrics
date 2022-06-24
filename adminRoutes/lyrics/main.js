const express = require('express');
const formidable = require('formidable');
const fs = require('fs')
const path = require('path');
const s3 = require("../../libs/aws")
const lyricsRouter = express.Router();
const stringSimilarity = require("string-similarity")
const validate = require('../validate');
const songsModel = require('../../database/mongooseSchemas/songsSchema')
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const requestReportModel = require('../../database/mongooseSchemas/requestAndReports')

lyricsRouter.get('/api/c/contributor-request',validate,async(req,res)=> {
  try {
     const request = await requestReportModel.find({rrType:'contributor-request'})
     const requestUsers = request.map(a => a.userId)
     const users = await usersModel.find({userId: {$in: requestUsers}},{userId: 1,name:1,points:1,picture:1})
     if(users.length === 0 ) return res.json([])
     for(let i = 0; i < request.length; i++) {
        for(let j = 0; j < users.length; j++) {
          if(request[i].userId == users[j].userId) {
            request[i] = {
              name: users[j].name,points: users[j].points,
              picture: process.env.IMAGEURL + users[j].picture,
              id:request[i]._id,
              rrMessage: request[i].rrMessage
            }
            break;
          }
        }
     }
     res.json(request)
  } catch (e) {
     res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

lyricsRouter.get('/api/c/bug-reports',validate,async(req,res)=> {
   const bugs = await requestReportModel.find({rrType:'bug-report'})
   const requestUsers = bugs.map(a => a.userId)
   const users = await usersModel.find({userId: {$in: requestUsers}},{userId: 1,name:1,points:1,picture:1})
   if(users.length === 0 ) return res.json([])
   for(let i = 0; i < bugs.length; i++) {
      for(let j = 0; j < users.length; j++) {
        if(bugs[i].userId == users[j].userId) {
          bugs[i] = {
            name: users[j].name,points: users[j].points,
            picture: process.env.IMAGEURL + users[j].picture,
            id:bugs[i]._id,
            rrMessage: bugs[i].rrMessage
          }
          break;
        }
      }
   }
   res.json(bugs)
})


lyricsRouter.post('/api/upload-lyrics',validate2,async(req,res)=>{
try{
const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files)=> {
  if(err) return res.status(400).json({type:"ERROR",msg: "not able to process files please try again"});
  if(!fields.lyrics || !fields.songTitle ||
     !fields.songGenre || !fields.artist || !files.cover ||
     !fields.releaseDate || !fields.youtubeVideo || !fields.writers){
    return res.status(400).json({type:'ERROR',msg:'Missing some request bodies'})
  }
  if(!isValidArtistName(fields.artist) ||
   !isValidArtistName(fields.otherArtists)) {
    return res.json({type:'ERROR',msg:'invalid artist name'})
  }
  if(fields.lyrics.trim() === "" || fields.songTitle.trim() === "" ||
     fields.songGenre.trim() === "" ||
     fields.artist.trim() === "" ||
     fields.releaseDate.trim() === "" ||
      fields.youtubeVideo.trim() === "" || fields.writers.trim() === ""){
    return res.status(400).json({type:'ERROR',msg:'only features field can be empty'})
  }

  let image = files.cover;
  let stats = fs.statSync(image.path)
  let sizeInMb = stats.size/(1024 * 1024)
  if(sizeInMb > 3) return res.status(400).json({type:'ERROR',msg:'image file too large'})

  image.name =  Date.now() + image.name.replace("/\W/g","");
  let extNameImage = path.extname(image.name);
  if(extNameImage != '.jpg' ){
    return res.status(400).json({type:"ERROR", msg: 'invalid image file format'});
  }
  const {lyrics,artist,songGenre,songTitle,producer,
  writers,otherArtists,releaseDate,youtubeVideo}  = fields;
  const songUploadedAlready = await songsModel.findOne({songTitle:songTitle,songArtist:artist})
  if(songUploadedAlready) return res.status(409).json({type:'ERROR', msg:'song uploaded already'})
  const songs = await songsModel.find({},{punchlines:1})
  const rawBars = reducePunchlines(songs)
  let sm = stringSimilarity.findBestMatch(lyrics,rawBars)

  if(sm.bestMatch.rating > 0.85) return res.status(409).json({type:'ERROR',msg:"song already uploaded"})

  let punchlinesArray = validateLyricsFormat(lyrics);
   if(!Array.isArray(punchlinesArray)) {
     return res.status(400).json({type: 'ERROR',msg:"wrong lyrics format"})
   }
  const fileContent = fs.readFileSync(image.path);
   fs.unlinkSync(image.path)
  const params = {
      Bucket: 'toonjimages',
      Key: image.name,
      Body: fileContent,
      ContentType: 'image/jpg',
  };
  s3.upload(params, (err, data) => {
      if (err) {

          res.status(500).json({type:'ERROR',msg:'error uploading image'})
      }else {
        let uploader;
        if(req.session.user) {
          uploader = req.session.user.userId
        }else {
          uploader = req.session.admin.userId
        }
    let song = new songsModel({
       songId: generateID(),
       songArtist: artist,
       uploadedBy: uploader,
       songGenre,
       songTitle,
       producer,
       otherArtists,
       writers,
       youtubeVideo,
       songCover: image.name,
       releaseDate,
       uploadDate: new Date(),
       punchlines: punchlinesArray
    })

    song.save((err,result)=>{
      if(err) return res.status(500).json({type:"ERROR", msg:'not able to save song details'});
        res.json({type: "SUCCESS", msg: "song successfully uploaded"})
    });
  }
})
 })
}catch(e) {
  res.status(500).json({type:'ERROR',msg:'something went wrong'})
}
})


lyricsRouter.get('/api/edit-lyrics/:songId',async (req,res) => {
  try {
    let songId = req.params.songId
    let song = await songsModel.findOne({songId})
    if(song === null) {
     return res.status(400).json({type:'ERROR',msg:'song not found'})
    }
    let data =  {
      artist: song.songArtist,
      songTitle: song.songTitle,
      songGenre: song.songGenre,
      producer: song.producer,
      lyrics: song.punchlines,
      releaseDate: song.releaseDate,
      otherArtists: song.otherArtists,
      writers: song.writers,
      youtubeVideo: song.youtubeVideo
    }
    res.json(data)
  } catch (e) {

    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

lyricsRouter.get("/api/songs/reported-songs",validate,async(req,res)=> {
    try {
       let reportedSongs = await songsModel.find({reports: {$exists:true,
         $not: {$size: 0}}}
         ,{songId:1,songTitle:1,songArtist:1,reports:1,songCover:1})
         reportedSongs = reportedSongs.map(song => {
           song.songCover = process.env.IMAGEURL + reportedSongs.songCover
           return song
         })
         return res.json(reportedSongs)
    } catch (e) {
      res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
})

lyricsRouter.post('/api/songs/clear-reports/:songId',validate,async(req,res)=> {
    try {
      let songId = req.params.songId
      let re = await songsModel.updateOne({songId},{$set: {
        reports: []
      }})
       res.json({type:'SUCCESS',msg:'reports cleared'})
    } catch (e) {
       res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
})

lyricsRouter.get('/api/songs/title/:songTitle',validate,async(req,res) => {
   try {
     let songs = await songsModel.find({songTitle:
       {$regex:"^"+req.params.songTitle,$options:'i'}},
       {songTitle:1,songId:1,songCover:1,songArtist:1})
       songs = songs.map(song => {
         song.songCover = process.env.IMAGEURL + song.songCover
         return song
       })
     return res.json(songs)
   } catch (e) {
     return res.status(500).json({type:'ERROR',msg:'something went wrong'})
   }
})

lyricsRouter.get('/api/songs/user/:name',validate,async(req,res)=> {
  try {
    const songs = await songsModel.find({songArtist: req.params.name},
      {songTitle:1,songId:1,songCover:1,songArtist:1})
      songs = songs.map(song => {
        song.songCover = process.env.IMAGEURL + songs.songCover
        return song
      })
    return res.json(songs)
  } catch (e) {
    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

lyricsRouter.post('/api/songs/delete/:songId',validate,async(req,res)=> {
    try {
      await songsModel.deleteOne({songId: req.params.songId})
      return res.json({type:'SUCCESS',msg:'song deleted'})
    } catch (e) {

      return res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
})




lyricsRouter.post('/api/edit-lyrics/:id',validate2,async (req,res)=>{
    try{
    let songToEdit = await songsModel.findOne({songId:req.params.id})
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files)=> {
    if(err) return res.json({type:"ERROR",msg: "not able to process files please try again"});

    if(!fields.lyrics || !fields.songTitle ||
       !fields.songGenre || !fields.artist ||
       !fields.releaseDate || !fields.youtubeVideo || !fields.writers){
      return res.status(400).json({type:'ERROR',msg:'Missing some request bodies'})
    }
    if(!isValidArtistName(fields.artist) ||
     !isValidArtistName(fields.otherArtists)) {
      return res.status(400).json({type:'ERROR',msg:'invalid artist name'})
    }
    if(fields.lyrics.trim() === "" || fields.songTitle.trim() === "" ||
       fields.songGenre.trim() === "" ||
       fields.artist.trim() === "" ||  fields.releaseDate.trim() === "" ||
        fields.youtubeVideo.trim() === "" || fields.writers.trim() === ""){
          return res.status(400).json({type:'ERROR',msg:'only features field can be empty'})
        }
    let image = files.cover;
    if(image !== undefined){
      let stats = fs.statSync(image.path)
      let sizeInMb = stats.size/(1024 * 1024)
      if(sizeInMb > 3) return res.status(400).json({type:'ERROR',msg:'image file too large'})
    let extNameImage = path.extname(image.name);
    if(extNameImage != '.jpg'){
      return res.status(400).json({type:"ERROR", msg: 'invalid image file formats'});
    }
   }
    const {lyrics,artist,songGenre,songTitle,producer,
      writers,otherArtists,releaseDate,youtubeVideo}  = fields;
      if(!isValidArtistName(artist) ||
       !isValidArtistName(otherArtists)) {
        return res.status(400).json({type:'ERROR',msg:'invalid artist name'})
      }

      let punchlinesArray = validateLyricsFormatEdit(lyrics,songToEdit.punchlines);
       if(!Array.isArray(punchlinesArray)) {
         return res.status(400).json({type: 'ERROR',msg:"wrong lyrics format"})
       }
       let editor;
       if(req.session.user){
         editor = req.session.user.userId
       }else {
         editor = req.session.admin.userId
       }
        if(image){
       const fileContent = fs.readFileSync(image.path);
        fs.unlinkSync(image.path)
        console.log(songToEdit.songCover);
       const params = {
           Bucket: 'toonjimages',
           Key: songToEdit.songCover,
           Body: fileContent,
           ContentType: 'image/jpg',
       };
       let editor;
       if(req.session.user){
         editor = req.session.user.userId
       }else {
         editor = req.session.admin.userId
       }
       s3.upload(params, function(err, data) {
           if (err) {
               res.status(400).json({type:'ERROR',msg:'error uploading image'})
           }else {
       songsModel.updateOne({songId: req.params.id}, {$set:
         {songArtist: artist,
         songGenre,
         songTitle,
         producer,
         otherArtists,
         releaseDate,
         writers,
         youtubeVideo,
         punchlines: punchlinesArray
       },$push:{editors:editor}},(err,data)=>{
         if(err) return res.status(400).json({type:'ERROR',msg:"couldn't save your edit"})
         return res.json({type:'SUCCESS',msg:'successfully updated',data})
       });
     }
   })
 }else {
   songsModel.updateOne({songId: req.params.id}, {$set:
     {songArtist: artist,
     songGenre,
     songTitle,
     producer,
     otherArtists,
     releaseDate,
     writers,
     youtubeVideo,
     punchlines: punchlinesArray
   },$push:{editors:editor}},(err,data)=>{
     if(err) return res.status(500).json({type:'ERROR',msg:"something went wrong"})
     return res.json({type:'SUCCESS',msg:'successfully updated',data})
   });
 }
   })
 }catch(err){
  return res.json({type:"ERROR",msg:"something went wrong"})
}
});


function validate2(req,res,next) {
   let isContributor  =  req.session.user ? req.session.user.isContributor : false
   if(!req.session.admin && !isContributor){
      res.status(401).json({type:'ERROR',msg: "you're authorized to perform this actoin"})
   }else {
     next()
   }
}



function generateID() {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < 11; i++) {
    str += chars[Math.floor((Math.random() * (chars.length)))];
  }
  return str
}

function isValidArtistName(name){
    name = name.split(' ')
    for(let i = 0; i < name.length; i++) {
     if(name[i][0] !== undefined){
      if(name[i][0].toUpperCase() !== name[i][0]) {
        return false;
      }
    }
    }
    return true;
}

function validateLyricsFormatEdit(lyrics,punchlinesObj){
  let arr = lyrics.split(";")
  let punchlines = []
  if(arr.length !== punchlinesObj.length){
    return "punchlines length don't match"
  }
  let currentArtist = ""

  for(let i = 0; i < arr.length ; i++) {
          let start = arr[i].indexOf('[');
          let end = arr[i].indexOf(']');
      if(start > -1 && end > -1) {
        currentArtist = arr[i].substring(start + 1,end);
      }
      let hasIcons = arr[i].substr(arr[i].length - 3, arr[i].length) === "--r" ? false : true;
      punchlines.push({
         punchline: i === 0 ? arr[i] : arr[i].replace('\n',""),
         artist: currentArtist,
         hasIcons: hasIcons
      });
  }

  for(let i = 0; i < punchlinesObj.length; i++) {
    punchlinesObj[i].punchline = punchlines[i].punchline;
    punchlinesObj[i].artist = punchlines[i].artist;
    punchlinesObj[i].hasIcons = punchlines[i].hasIcons
  }
  return punchlinesObj
}

function reducePunchlines(bars) {
  let rawBars = []
  for(let i = 0; i < bars.length; i++) {
    let bar = bars[i].punchlines.reduce((a,b)=> {
      return a + b.punchline
    },"")
    rawBars.push(bar)
  }
  return rawBars
}

function validateLyricsFormat(lyrics) {
  let arr = lyrics.split(";");
  let punchlines = [];
  if(arr.length < 8) return "not enough punchlines";
  let currentArtist = ""
  for(let i = 0; i < arr.length ; i++) {
          let start = arr[i].indexOf('[');
          let end = arr[i].indexOf(']');
      if(start > -1 && end > -1) {
        currentArtist = arr[i].substring(start + 1,end);
      }
      let hasIcons = arr[i].substr(arr[i].length - 3, arr[i].length) === "--r" ? false : true
      punchlines.push({
         punchline: i === 0 ? arr[i] : arr[i].replace('\n',""),
         artist: currentArtist,
         raters: [],
         breakdowns: [],
         hasIcons: hasIcons
      });
  }
  return punchlines;
}

module.exports = lyricsRouter;
