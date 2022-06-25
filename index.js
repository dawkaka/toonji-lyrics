require('dotenv').config()
const express = require('express');
const app = express();
const fs  = require("fs")
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose')
const jwt = require("jsonwebtoken")
const helmet = require("helmet");
const path = require('path')
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const bodyParser = require('body-parser')
const cors = require('cors');
const usersModel = require("./database/mongooseSchemas/usersSchema")
const battlesModel = require("./database/mongooseSchemas/battleSchema")
const songsModel = require("./database/mongooseSchemas/songsSchema")
const allBattlesModel = require("./database/mongooseSchemas/allBattlesSchema")

const openRoutes = require('./openroutes/main')
const protectedRoutes = require('./protectedroutes/main');
const adminRoutes = require('./adminRoutes/main')
const jsonParser = bodyParser.json()
const cookieParser = require("cookie-parser")
app.use(helmet())
app.use(cors({
origin: ['http:// 192.168.43.59:3000','http://localhost:19006','http://localhost:3000',
'https://toonji.com'],
credentials:true,
exposedHeaders:['set-cookie',"Date"]
}))

switch(app.get('env')){
  case 'development':        // compact, colorful dev logging
  app.use(require('morgan')(':method :url :status :res[content-length] - :response-time ms'));
    break;
  case 'production':        // module 'express-logger' supports daily log rotation
  app.use(require('express-logger')({
  path: __dirname + '/log/requests.log'}));
   break;
 }

app.use(function(req, res, next) {
   res.setTimeout(30 * 1000);
   next();
});

app.use(bodyParser.urlencoded({extended:false}));
app.use(jsonParser)
app.use(cookieParser(process.env.cookieSecret));
app.use(session({
  key: 'user_id',
  secret: process.env.cookieSecret,
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    SameSite: "None",
    Secure: true
  },
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    clear_interval: 10
  })
}));
app.disable('x-powered-by')

app.use(function(req,res,next){
const cluster = require('cluster');
if(cluster.isWorker)
next()
});


app.use((req,res,next)=> {
  const domain = require('domain').create()
  domain.on('erorr',(err)=> {
    try {
      setTimout(()=> {
        console.error('false shutdown')
        process.exit(1)
      },5000)
      const woker  = require('cluster').worker()
      if(worker) {
        worker.disconnect()
      }
      server.close()
      try {
        next(err)
      } catch (e) {
        res.status(500)
        res.json({type:'ERROR',msg:'something went wrong'})
      }
    } catch (e) {
        res.status(500)
        res.json({type:'ERROR',msg:'something went wrong'})
    }
  });
  domain.add(req)
  domain.add(res)
  domain.run(next)
});

io.of("/api-battle").on('connection',socket => {
 socket.on("disconnecting", async () => {
   let room;
   let socketId
   for (let key of socket.adapter.sids.keys()) {
     if(socket.id === key) {
       socketId = key
       break
     }
   }

   for (let key of socket.adapter.sids.get(socketId)) {
      if(key !== socket.id) {
        room = key
         break
      }
   }

   socket.leave(room)
    let rooms = io.of("/api-battle").adapter.rooms.get(room)
     if (!rooms) {
       await battlesModel.updateOne({battleId:room},{$set:{battleInProcess:false,connectedUsers:[]}})
     }else {
       socket.to(room).emit("opponent-disconnected",socket.id)
     }
  })

  socket.on("get-questions", async roomId => {
    //genearte questions and sent to all connected users in the room
    const target = await battlesModel.findOne({battleId:roomId},{artists:1})

    const songs = await songsModel.find({songArtist:{$in: target.artists}},{songTitle: 1, otherArtists: 1, punchlines: 1, songArtist: 1})

    let questions = [];
    if(songs && songs.length > 0) questions = generateQuestions(songs)
    if(questions && questions.length === 10) {
      await battlesModel.updateOne({battleId:roomId},{$set:{battleInProcess: true}})
    }
    io.of("/api-battle").to(roomId).emit("questions",questions)
  })

  socket.on("new-points", async data => {
    try {
      let cookies;
      try {
         cookies = socket.handshake.headers.cookie.split(";").filter(a => {
          return a.substr(0,a.indexOf("=")) === " _user_id" || a.substr(0,a.indexOf("=")) === "_user_id"
        })[0].split("=")[1]
      } catch (e) {
         io.of("/api-battle").to(socket.id).emit("login required","login required")
         return
      }
      const user = await usersModel.findOne({name: cookies})
      const battleId = user.battles[user.battles.length - 1]

      const battleInfo = await allBattlesModel.findOne({battleId})
      if(battleInfo.battleOwner.socketId === socket.id) {
        await allBattlesModel.updateOne({battleId},{$set:{
          battleOwner: {
            socketId: battleInfo.battleOwner.socketId,
            userId: battleInfo.battleOwner.userId,
            userPoints: battleInfo.battleOwner.userPoints + data[0]
          }
        }})
      }else {
        await allBattlesModel.updateOne({battleId},{$set:{
          opponent: {
            socketId: battleInfo.opponent.socketId,
            userId: battleInfo.opponent.userId,
            userPoints: battleInfo.opponent.userPoints + data[0]
          }
        }})
      }
      socket.to(data[1]).emit("opponent-points",data[0])
    } catch (e) {
    }
  })
  socket.on("user-ended", async roomId => {
    socket.leave(roomId)
    let room = io.of("/api-battle").adapter.rooms.get(roomId)
    if(!room || room.size === 0) {
    await battlesModel.updateOne({battleId: roomId},{$set:{battleInProcess: false,connectedUsers:[]}})
    }else {
        socket.to(roomId).emit("opponent-ended","opponent has finished with their questions")
    }
  })
  socket.on("join-room",async roomId => {
    //check if linkid id valid
    const battleLink = await battlesModel.findOne({battleId: roomId})
    if(!battleLink || Date.now() - battleLink.createdDate > 24 * 60 * 60 * 1000) {
      io.of("/api-battle").to(socket.id).emit("invalid link","Invalid or expired link")
      return
    }
    if(battleLink.battleInProcess) {
      io.of("/api-battle").to(socket.id).emit("in-process","There's a battle in process on this link")
      return
    }
    //check if user is logged in
    let cookies;
    try {
       cookies = socket.handshake.headers.cookie.split(";").filter(a => {
        return a.substr(0,a.indexOf("=")) === " _user_id" || a.substr(0,a.indexOf("=")) === "_user_id"
      })[0].split("=")[1]
    } catch (e) {
       io.of("/api-battle").to(socket.id).emit("login required","login required")
       return
    }
    let isOwner = false;
    const battleOwner = await battlesModel.findOne({battleId: roomId})
    const user  = await usersModel.findOne({name: cookies},{name:1,userId:1})
    if(battleOwner.battleOwner === user.userId) isOwner = true
    //all set let use join room if room is not yet full
    const ownerJoined = battleOwner.ownerJoined
    const rooms = io.of("/api-battle").adapter.rooms.get(roomId)
     //console.log(!rooms,(!ownerJoined && !rooms),(ownerJoined && rooms.size === 1),isOwner);
     if(!rooms || (!ownerJoined && !rooms) || (ownerJoined && rooms.size === 1) || isOwner){
       socket.join(roomId)
       if(isOwner) {
        await battlesModel.updateOne({battleId:roomId},{$set: {ownerJoined: true}})
       }
       await battlesModel.updateOne({battleId: roomId},{$push:{connectedUsers: {
         socketId: socket.id,
         userId:  user.userId
       }}})
       if (rooms !== undefined && rooms.size === 2) {
         //create a battle info and insert it into database
        const battleUsers = await battlesModel.findOne({battleId: roomId})
        let battleOwner, opponent;
        let conn = battleUsers.connectedUsers
        for(let i = 0; i < conn.length; i++) {
          if(conn[i].userId === battleUsers.battleOwner) {
            battleOwner = conn[i]
          }else {
            opponent = conn[i]
          }
        }
         const allBattleId =  generateID(25);
         const allBattle = new allBattlesModel({
           battleId:allBattleId,
           battleOwner: {
             userId: battleOwner.userId,
             socketId: battleOwner.socketId
           },
           opponent: {
             userId:   opponent.userId,
             socketId: opponent.socketId
           }
         })
        await allBattle.save()
        await usersModel.updateMany({userId:{$in:[battleOwner.userId,opponent.userId]}},{$push:{battles: allBattleId}})
        const userNames = await usersModel.find({userId:{$in:[battleOwner.userId,opponent.userId]}},{name:1,userId:1})
        let ownerName,oppName;
        for(let i = 0; i < userNames.length; i++) {
          if(userNames[i].userId === battleOwner.userId) {
            ownerName = userNames[i].name
          }else {
            oppName = userNames[i].name
          }
        }

         io.of("/api-battle").to(battleOwner.socketId).emit("all-set",oppName)
         io.of("/api-battle").to(opponent.socketId).emit("set",ownerName)
       }else {
          io.of("/api-battle").to(socket.id).emit("joined","waiting for others")
       }
     }else {
       io.of('/api-battle').to(socket.id).emit("link-full")
     }
  })
});

  app.use(openRoutes);
  app.use(protectedRoutes);
  app.use(adminRoutes);

const PORT = process.env.PORT || 5000;

function startServer() {
 http.listen(PORT, ()=>{
 console.log('Express started on ' + PORT + ' in ' + app.get('env'));
 });
}
if(require.main === module){
// application run directly; start app server
   startServer();
} else {
// application imported as a module via "require": export function
// to create server
   module.exports = startServer
}

function generateQuestions(songs) {
  let generatedQuestions = []
  let gLength = 0;
  for(let i = 0; gLength < 10 ; i++) {

    let randomSong = songs[Math.floor(Math.random() * songs.length)]
    const qTitles = [`What ${randomSong.songArtist} song was this said ?`,
      'Complete the lyrics'];
    if(randomSong.otherArtists && randomSong.otherArtists !== "") {
      qTitles.push(`Which artist said this on the song ${randomSong.songTitle} ?`)
    }
    let currentQuestion = qTitles[Math.floor(Math.random() * qTitles.length)];
    let randomPunchline = randomSong.punchlines[Math.floor(Math.random() * randomSong.punchlines.length)]
    switch (currentQuestion.substr(0,4)) {
      case 'What':
      let queWhat = randomPunchline.punchline.replace(`/${randomPunchline.songTitle}/g`,'*_*')
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
      case 'Whic':
      let queWhic = randomPunchline.punchline.replace(`/${randomPunchline.artist}/g`,'*_*')
          generatedQuestions.push({
            questionTitle: currentQuestion,
            questionText: queWhic,
            questionAnswer: randomPunchline.artist
          })
          gLength++
          break;
      default:
        continue
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



/*['http://localhost:19006','http://localhost:3000',
'https://toonji.com']*/
