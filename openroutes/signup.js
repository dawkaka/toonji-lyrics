const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
const signupRoute = express.Router();
const usersModel = require('../database/mongooseSchemas/usersSchema');

signupRoute.post('/api/signup',async (req,res)=> {

  let {name,email,password } = req.body;

  let errorMessages = {general: [], password: [], email: []};
  let user;
  if(name === undefined || email === undefined || password === undefined){
    return res.status(400).json({type:'ERROR',msg:'missing some request bodies'})
  }
  validateSignup(req.body,errorMessages);

  if(errorMessages.general.length || errorMessages.password.length ||errorMessages.email.length){
    return res.status(400).json({type:"ERROR",
                      msg:"check enteries and try again",
                      data:[...errorMessages.general,...errorMessages.password,...errorMessages.email]});
  }

  name = name.toString().trim()
  email = email.toString().trim().toLowerCase()
  password = password.toString().trim()

  try {
    user = await usersModel.findOne({$or: [{name: {$in:[name,name.toLowerCase()]}},{email}]});
  } catch (e) {
     res.status(500).json({type:'ERROR',msg:"Something went wrong"})
  }
  if(user) {
    return user.email === email ?  res.status(400).json({type:"ERROR",msg: "Email already exist"}) :
     res.status(400).json({type:"ERROR",msg: "Name already exist"})
  }else {

    let hashedPassword = '';
    try {
      let salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password + process.env.STRTNPWD,salt);
      const user = new usersModel({
         name,
         email,
         userId : generateID(),
         password: hashedPassword,
         userCoins: 1000,
         dateJoined: new Date(),
       })
     await user.save();
     let userId = await usersModel.findOne({name},{name:1,email:1,userId:1});
     req.session.user = {
       userId: userId.userId,
       userName: userId.name,
       name: userId.name,
       email: userId.email,
       isLoggedIn: true
     };

     res.cookie('_user_id',userId.name, {maxAge: 1000 * 60 * 60 * 24 * 7});
     return   res.json({type:"SUCCESS",msg:"registered successfully"})
    } catch (e) {
      res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
  }
});


signupRoute.post('/api/m/signup',async (req,res)=> {

  let {name,email,password } = req.body;

  let errorMessages = {general: [], password: [], email: []};
  let user;
  if(name === undefined || email === undefined || password === undefined){
    return res.status(400).json({type:'ERROR',msg:'Missing some request bodies'})
  }
  validateSignup(req.body,errorMessages);

  if(errorMessages.general.length || errorMessages.password.length ||errorMessages.email.length){
    return res.status(400).json({type:"ERROR",
                      msg:"check enteries and try again",
                      data:[...errorMessages.general,...errorMessages.password,...errorMessages.email]});
  }

  name = name.toString().trim()
  email = email.toString().trim()
  password = password.toString().trim()

  try {
    user = await usersModel.findOne({$or: [{name},{email}]});
  } catch (e) {
     res.status(500).json({type:'ERROR',msg:"something went wrong"})
  }
  if(user) {
    return user.name === name ?  res.json({type:"ERROR",msg: "name already exist"}) :
     res.json({type:"ERROR",msg: "email already exist"})
  }else {

    let hashedPassword = '';
    try {
      let salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password + process.env.STRTNPWD,salt);
      const user = new usersModel({
         name,
         email,
         userId : generateID(),
         password: hashedPassword,
         dateJoined: new Date(),
       })
     let userId = await user.save();

     const token = jwt.sign({
       userId: userId.userId,
       userName: userId.name,
       name: userId.name,
       email: userId.email,
     },process.env.TOKEN_SECRET, {expiresIn:'90s'})

     res.set("Authorization", "bearer " + token)
     return   res.json({type:"SUCCESS",msg:"registered successfully",token})

     return res.status(400).json({type:'ERROR',msg:'something went wrong'})
    } catch (e) {
      res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
  }
});



















function generateID(n = 11) {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < n; i++) {
    str += chars[Math.floor((Math.random() * (chars.length)))];
  }
  return str
}

function validateSignup(body,errorMessages) {
 if(!(body.name || body.email || body.password || body.repeatPassword)) {
   errorMessages.general.push("fields are required");
 }
 if(body.password.toString().length < 6) {
   errorMessages.password.push("password must be greater 6 characters")
 }
 if(body.password.toString().trim() != body.repeatPassword.toString().trim()) {
   errorMessages.password.push("passwords don't match")
 }
 if(body.name.toString().match(/\W/)) {
   errorMessages.general.push("non alphabets aren't allowed")
 }
 if(body.name.toString().length > 15){
   errorMessages.general.push("name can not be greater than 15 characters")
 }
 if(!(body.email.toString().match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g))) {
   errorMessages.email.push("entry is not an email")
 }
}
module.exports = signupRoute;
