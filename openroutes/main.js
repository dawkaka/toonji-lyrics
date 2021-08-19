const express = require('express');
const openRoutes = express.Router();
const homeRoute = require('./home');
const chartsRoute = require('./charts');
const viewLyricsRoute = require('./readLyrics');
const signupRoute = require('./signup')
const loginRoute = require('./login')
const adminsSignupRoute = require('./adminsignUp');
const adminLoginRoute = require('./adminLogin')
openRoutes.use(homeRoute)
openRoutes.use(chartsRoute)
openRoutes.use(viewLyricsRoute)
openRoutes.use(signupRoute)
openRoutes.use(loginRoute)
openRoutes.use(adminsSignupRoute)
openRoutes.use(adminLoginRoute)

// openRoutes.use((req,res)=>{
//   return res.status(404).json({msg: 'page not found'})
// })
module.exports = openRoutes;
