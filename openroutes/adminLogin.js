const express = require('express');
const bcrypt = require('bcryptjs')
const adminLoginRoute = express.Router();
const adminsModel = require('../database/mongooseSchemas/adminsSchema')

adminLoginRoute.post('/api/c/contributor-login',async (req,res)=>{
  if(req.session.admin !== undefined) {
    return res.json({type:"SUCCESS",msg: "you are already logged in"})
  }

  if(req.session.loginNextTry > Date.now()) {
    let newTime = new Date(req.session.loginNextTry - Date.now()).getMinutes()
    return res.status(401).json({type:'ERROR',msg: "try again in " + `${newTime + 1}` + " minutes"})
  }

   const {name,password} = req.body;
   if(name === undefined || password === undefined) {
     return res.status(400).json({type: 'ERROR',msg:'missing request body parts'})
   }
   let salt = await bcrypt.genSalt(10);
   hashedPassword = await bcrypt.hash(password + process.env.STRTNPWD,salt);
    let admin = await adminsModel.findOne({name})
  if(!admin) return res.status(400).json({type:'ERROR',msg:'admin not found'})

   let isValidPassword = await bcrypt.compare(password + process.env.STRTNPWD,admin.password)
    if(isValidPassword){
      req.session.admin = {
        userId: admin.userId,
        name: name,
        isAdmin: true,
      };
      return  res.json({type:"SUCCESS",msg: "logged in successfuly"})
    }else {
      req.session.loginAttempts++
      if(req.session.loginAttempts > 4) {
        req.session.loginNextTry = Date.now() + (1000 * 60 * req.session.loginAttempts)
      }
    }
    res.status(400).json({type:'ERROR',msg:'invalid login credentials'})
});

function generateID(n = 11) {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < n; i++) {
    str += chars[Math.floor((Math.random() * (chars.length)))];
  }
  return str
}
module.exports  = adminLoginRoute;
