const express = require('express');
const adminsSignupRoute = express.Router();
const adminsModel = require('../database/mongooseSchemas/adminsSchema');

adminsSignupRoute.post('/api/c/contributor-request',async (req,res)=>{
   const {name,email} = req.body;
   let errorMessages = {general: [], email: []}
   if(name === undefined || email === undefined){
     return res.status(400).json({type:'ERROR',msg:'Missing some request bodies'})
   }
   validateSignup(req.body,errorMessages);
   if(errorMessages.general.length || errorMessages.email.length) {
     return res.status(400).json({type:'ERROR',errorMessages});
   }
   let admin;
   try{
     admin = await adminsModel.findOne({$or: [{name},{email}]});
   }catch(e){
   res.status(500).json({type:'ERROR',msg:'something went wrong'});
 }
   if(admin.length){
    return admin.name === name ? res.json({type: 'ERROR', msg:'Admin name already exists'}):
    res.status(409).json({type:'ERROR', msg:'Admin email already exists'});
  }

    admin = new adminsModel({
      name,
      email,
      password: generateID(),
      dateRequested: new Date(),
    });
    try {
      await admin.save();
    }catch(e){
      return res.status(500).json({type:'ERROR', msg:'something went wrong'});
    }
    adminId = adminsModel.findOne({name});
    req.session.admin = {
      userName: adminId.name,
      email: adminId.email,
      isAdmin: true
    };
    res.json({type:'SUCESS',msg:'contributor request received successfully'})

});

function validateSignup(body,errorMessages) {
 if(body.name === '' || body.email === '') {
   errorMessages.general.push("fields are required");
 }
 if(!(body.email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g))) {
   errorMessages.email.push("entry is not an email")
 }
}
function generateID() {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < 9; i++) {
    str += chars[Math.floor((Math.random() * (chars.length-1)) + 1)];
  }
  return str;
}

module.exports = adminsSignupRoute;
