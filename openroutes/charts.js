const express = require('express');
const chartsRoute = express.Router();
const songsModel = require('../database/mongooseSchemas/songsSchema');
const usersModel = require('../database/mongooseSchemas/usersSchema')

chartsRoute.get('/api/charts/:chartParam',async (req,res)=> {
try{
 let param = req.params.chartParam
 if(param === "Songs"){
   const data = await songsModel.find({},{songId:1,songTitle:1,songArtist:1,
   otherArtists:1,raters:1,views:1,songCover:1});
   let today,week,allTime;
   today = data.sort((a,b)=> {
     let now = new Date()
     let elemRatingA = getRating(a,"TODAY",now);
     let elemRatingB = getRating(b,"TODAY",now)
     let elemViewsA = getViews(a,"TODAY",now)
     let elemViewsB = getViews(b,"TODAY",now)
     elemRatingA = ratingValue(elemRatingA)
     elemRatingB = ratingValue(elemRatingB)
     b.determinePosition = elemViewsB + elemRatingB
     a.determinePosition = elemViewsA + elemRatingA
     return b.determinePosition - a.determinePosition
   }).map(a => {
     let rating = getRating(a.raters,'ALL-TIME',new Date())
     let newObj = {
       songTitle: a.songTitle,
       lyricId: a.songId,
       songArtist: a.songArtist,
       rating: rating,
       view: numberToKOrM(a.views.length),
       otherArtists: a.otherArtists,
       songCover: a.songCover
     }
     return newObj
   })

   week = data.sort((a,b)=> {
     let now = new Date()
     let elemRatingA = getRating(a,"WEEK",now);
     let elemRatingB = getRating(b,"WEEK",now)
     let elemViewsA = getViews(a,"WEEK",now)
     let elemViewsB = getViews(b,"WEEK",now)
     elemRatingA = ratingValue(elemRatingA)
     elemRatingB = ratingValue(elemRatingB)
     b.determinePosition = elemViewsB + elemRatingB
     a.determinePosition = elemViewsA + elemRatingA
     return b.determinePosition - a.determinePosition
   }).map(a => {
     let rating = getRating(a.raters,'ALL-TIME',new Date())
     let newObj = {
       songTitle: a.songTitle,
       lyricId: a.songId,
       songArtist: a.songArtist,
       rating: rating,
       view: numberToKOrM(a.views.length),
       otherArtists: a.otherArtists,
       songCover: a.songCover
     }
     return newObj
   })

   allTime = data.sort((a,b)=> {
     let now = new Date()
     let elemRatingA = getRating(a.raters,"all-time",now);
     let elemRatingB = getRating(b.raters,"all-time",now)
     let elemViewsA = getViews(a,"all-time",now)
     let elemViewsB = getViews(b,"all-time",now)
     elemRatingA = ratingValue(elemRatingA)
     elemRatingB = ratingValue(elemRatingB)
     b.determinePosition = elemViewsB + elemRatingB
     a.determinePosition = elemViewsA + elemRatingA
     return b.determinePosition - a.determinePosition
   }).map(a => {
     let rating = getRating(a.raters,'ALL-TIME',new Date())
     let newObj = {
       songTitle: a.songTitle,
       lyricId: a.songId,
       songArtist: a.songArtist,
       rating: rating,
       view: numberToKOrM(a.views.length),
       otherArtists: a.otherArtists,
       songCover: a.songCover
     }
     return newObj
   })

   res.json({today:today.splice(0,20),week:week.splice(0,20),allTime:allTime.splice(0,20)});
   return
 }
   if(param === "Punchlines") {
     const songs = await songsModel.find({})
     const topBars = getTopPunches(songs)
     let allTime = topBars.allTime.map(a => {
       return {
         punchline: a.punchline,
         songId: a.songId,
         songTitle: a.songTitle,
         artist: a.artist,
         otherArtists: a.otherArtists,
         fires: a.raters.length,
         songArtist: a.songArtist,
         punchlineId: a._id
       }
     })
     let day = topBars.day.map(a => {
       return {
         punchline: a.punchline,
         songId: a.songId,
         songTitle: a.songTitle,
         artist: a.artist,
         otherArtists: a.otherArtists,
         fires: a.raters.length,
         songArtist: a.songArtist,
         punchlineId: a._id
       }
     })

     let week = topBars.week.map(a => {
       return {
         punchline: a.punchline,
         songId: a.songId,
         songTitle: a.songTitle,
         artist: a.artist,
         otherArtists: a.otherArtists,
         fires: a.raters.length,
         songArtist: a.songArtist,
         punchlineId: a._id
       }
     })

     res.json({allTime,day,week})
  }
   if(param === "Users") {
    let users = await usersModel.find({verified:false},{picture:1,points:1,name:1,followers:1})
    users = users.sort((a,b)=> {
      return (b.points + b.followers.length) - (a.points + a.followers.length)
    })
    let data = users.splice(0,25);
     data = data.map(a=> {
       return {
         picture: a.picture,
         name: a.name,
         points: numberToKOrM(a.points),
         followers: numberToKOrM(a.followers.length)
       }
     })
    return res.json(data)
   }
}catch(e) {
  console.log(e);
  res.json({type:'ERROR',msg:'something went wrong'})
}
});

function getTopPunches(songs) {
 let barsObj = {allTime: [],week: [],day: []}
 for(let i = 0; i < songs.length; i++) {
   let song = songs[i]
    for( j = 0; j < song.punchlines.length; j++) {
      let punchline = song.punchlines[j]
       punchline.songId = song.songId
       punchline.songTitle = song.songTitle
       punchline.otherArtists = song.otherArtists
       punchline.songArtist = song.songArtist
       addToAllTime(barsObj.allTime,punchline)
       addToWeek(barsObj.week,punchline)
       addToDay(barsObj.day,punchline)
    }
 }
return barsObj
}

function addToAllTime(arr,punchline) {
   let rating = punchline.raters.length
   scoochArray(arr,punchline,rating)
}

function addToWeek(arr,punchline) {
  let rating = getWeeklyRating(punchline.raters)
  scoochArray(arr,punchline,rating,'week')
}

function addToDay(arr,punchline) {
  let rating = getDailyRating(punchline.raters)
  scoochArray(arr,punchline,rating,'day')
}

function getWeeklyRating(raters) {
  const timeBound = new Date() - 1000 * 60 * 60 * 24 * 7
  let weeklyRatings = raters.filter(a => a.date > timeBound)
  return weeklyRatings.length
}

function getDailyRating(raters) {
  const timeBound = new Date() - 1000 * 60 * 60 * 24
  let dailyRatings = raters.filter(a => a.date > timeBound)
  return dailyRatings.length
}

function scoochArray(arr,punchline,rating,filter = "all-time") {
  if(rating < 1) return
  switch (filter) {
    case "week":
    if(arr.length < 10) {
      arr.push(punchline)
    }else if(arr[arr.length - 1].raters.length >= rating) {
    return
    }else {
      arr[arr.length - 1] = punchline
    }
     arr.sort((a,b)=> getWeeklyRating(b.raters) - getWeeklyRating(a.raters))
      break;
    case "day":
    if(arr.length < 10) {
      arr.push(punchline)
    }else if(arr[arr.length - 1].raters.length >= rating) {
    return
    }else {
      arr[arr.length - 1] = punchline
    }
    arr.sort((a,b)=> getDailyRating(b.raters) - getDailyRating(a.raters))
      break;
    default:
      if(arr.length < 10) {
        arr.push(punchline)
      }else if(arr[arr.length - 1].raters.length >= rating) {
      return
      }else {
        arr[arr.length - 1] = punchline
      }
      arr.sort((a,b)=> b.raters.length - a.raters.length)
  }
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


function getRating(raters,filter,now) {
  let target = 0
  if(filter === "TODAY"){
    target = now - ((1000 * 60 * 60 * 24) + 1)
  }
  if(filter === 'WEEK'){
    target = now - ((1000 * 60 * 60 * 24 * 7) + 1)
  }
  let totalRating = 0;
  let elemCount = 0;
  for(let i = 0; i < raters.length; i++){
     if(raters[i].dateRated > target){
       totalRating += raters[i].rate
       elemCount++
     }
  }
  return (totalRating/elemCount).toPrecision(2)
}

function getViews(a,filter,now) {
  let target = 0
  if(filter === "TODAY"){
    target = now - ((1000 * 60 * 60 * 24) + 1)
  }else if(filter === 'WEEK'){
    target = now - ((1000 * 60 * 60 * 24 * 7) + 1)
  }
  let totalRating = 0;
  for(let i = 0; i < a.views.length; i++){
     if(a.views[i] > target){
       totalRating++
     }
  }
  return totalRating
}

function ratingValue(elemRating){
  elemRating = isNaN(elemRating) ? 0:elemRating;
   return elemRating * 20
  }

module.exports = chartsRoute;
