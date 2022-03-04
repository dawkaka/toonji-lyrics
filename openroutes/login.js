const express = require('express');
const loginRoute = express.Router();
const usersModel = require('../database/mongooseSchemas/usersSchema');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


loginRoute.post('/api/login',async (req,res)=> {
  if(req.session.loginNextTry > Date.now()) {
    let newTime = new Date(req.session.loginNextTry - Date.now()).getMinutes()
    return res.status(400).json({type:'ERROR',msg: "try again in " + `${newTime + 1}` + " minutes"})
  }
 let {name, password}  = req.body;
 if(name === undefined || password === undefined){
   return res.status(400).json({type:'ERROR',msg:'Missing some request bodies'})
 }
 let findName = await usersModel.findOne({name},{email:1,password:1,name:1,userId:1,isContributor:1});
 if(findName === null) {
   return res.status(400).json({type:"ERROR",msg:'check name and try again'})
 }

 let isValidPassword = await bcrypt.compare(password + process.env.STRTNPWD, findName.password) || await bcrypt.compare(password, findName.password)

 if(isValidPassword) {
   req.session.user = {
     userId: findName.userId,
     name: findName.name,
     userName: findName.name,
     email: findName.email,
     isContributor: findName.isContributor,
     isLoggedIn: true
   }

   res.cookie('_user_id',findName.name,{
     httpOnly: false,
     maxAge: 1000 * 60 * 60 * 24 * 30 * 12 * 5,
     SameSite: "None"
     });

   res.cookie('contributor',findName.isContributor,{
     httpOnly: false,
     maxAge: 1000 * 60 * 60 * 24 * 30 * 12 * 5,
     SameSite: "None"
   })

  return  res.json({type:'SUCCESS',msg: "logged in successfuly"})
} else {
  req.session.loginAttempts++
  if(req.session.loginAttempts > 4) {
    req.session.loginNextTry = Date.now() + (1000 * 60 * (req.session.loginAttempts - 2))
  }
}
  res.status(400).json({type:'ERROR',msg:"invalid login credentials"})
});


// loginRoute.post('/api/m/login',async (req,res)=> {
//   if(req.session.loginNextTry > Date.now()) {
//     let newTime = new Date(req.session.loginNextTry - Date.now()).getMinutes()
//     return res.json({type:'ERROR',msg: "try again in " + `${newTime + 1}` + " minutes"})
//   }
//  let {name, password}  = req.body;
//  if(name === undefined || password === undefined){
//    return res.json({type:'ERROR',msg:'Missing some request bodies'})
//  }
//  let findName = await usersModel.findOne({name},{email:1,password:1,name:1,userId:1,isContributor:1});
//  if(findName === null) {
//    return res.json({type:"ERROR",msg:'check name and try again'})
//  }
//
//  let isValidPassword = await bcrypt.compare(password, findName.password)
//
//  if(isValidPassword) {
//    const token = jwt.sign({
//      userId: findName.userId,
//      userName: findName.name,
//      name: findName.name,
//      email: findName.email,
//    },process.env.TOKEN_SECRET, {expiresIn:'900s'})
//    console.log(token)
//    return  res.json({type:'SUCCESS',msg: "logged in successfuly", token})
// } else {
//   req.session.loginAttempts++
//   if(req.session.loginAttempts > 4) {
//     req.session.loginNextTry = Date.now() + (1000 * 60 * (req.session.loginAttempts - 2))
//   }
// }
//   res.json({type:'ERROR',msg:"invalid login credentials"})
// });




module.exports = loginRoute;
