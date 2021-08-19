const express = require('express');
const bcrypt = require('bcryptjs');
const signupRoute = express.Router();
const usersModel = require('../database/mongooseSchemas/usersSchema');

signupRoute.post('/api/signup',async (req,res)=> {

  let {name,email,password } = req.body;

  let errorMessages = {general: [], password: [], email: []};
  let user;
  if(name === undefined || email === undefined || password === undefined){
    return res.json({type:'ERROR',msg:'Missing some request bodies'})
  }
  validateSignup(req.body,errorMessages);

  if(errorMessages.general.length || errorMessages.password.length ||errorMessages.email.length){
    return res.json({type:"ERROR",
                      msg:"check enteries and try again",
                      data:[...errorMessages.general,...errorMessages.password,...errorMessages.email]});
  }

  name = name.toString().trim()
  email = email.toString().trim()
  password = password.toString().trim()

  try {
    user = await usersModel.findOne({$or: [{name},{email}]});
  } catch (e) {
     res.json({type:'ERROR',msg:"something went wrong"})
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
     await user.save();
     let userId = await usersModel.findOne({name},{name:1,email:1,userId:1});
     if(userId !== null){
     req.session.user = {
       userId: userId.userId,
       userName: userId.name,
       name: userId.name,
       email: userId.email,
       isLoggedIn: true
     };
     res.cookie('_user_id',userId.name, { signed: true });
     return   res.json({type:"SUCCESS",msg:"registered successfully"})
   }else {
     return res.json({type:'ERROR',msg:'something went wrong'})
   }
    } catch (e) {
      res.json({type:'ERROR',msg:'something went wrong'})
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
