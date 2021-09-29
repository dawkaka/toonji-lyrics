const express = require('express');
const coinsRouter = express.Router();
const validate = require('../validate');
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const songsModel = require('../../database/mongooseSchemas/songsSchema')
const coinsPurchasesModel = require('../../database/mongooseSchemas/coinsPurchaseSchema')
const paypalApiModel = require('../../database/mongooseSchemas/apiUpdateSchema')
const axios = require('axios')

coinsRouter.post('/api/coins/buy-coins',validate,async (req,res) => {
 try{
   const {link} = req.body
   const userId = req.session.user.userId
   const transaction = await coinsPurchasesModel.findOne({link})

   if(transaction) return res.json({type:'ERROR',msg:'transaction already completed'})
   const newCoinPurchase = new coinsPurchasesModel({
     link: link,
     userId: userId,
     completed: false,
   })
   await newCoinPurchase.save()

   let apiInfo = await paypalApiModel.findOne({})
   if(!apiInfo) apiInfo = {token:"sometext",expiresIn:3,lastUpdate:2}
   let token = apiInfo.token
   let expiresIn = apiInfo.expiresIn
   let lastUpdate = apiInfo.lastUpdate
   if(lastUpdate + (expiresIn * 1000) < Date.now()) {
    let response = await axios({
          url: process.env.PAYPAL_API_GATEWAY + '/oauth2/token',
          method: 'post',
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
            'content-type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET
          },
          params: {
            grant_type: 'client_credentials',
          },
        });
        token =  response.data.access_token
        expiresIn = response.data.expires_in
     await paypalApiModel.updateMany({},{$set:
         {expiresIn: expiresIn, token: token,lastUpdate: Date.now()
         }})
   }
   let response = await axios.get(link,{headers: {'Authorization': "Bearer " + token}})
   let data  = response.data;

   const amount = data.purchase_units[0].amount.value;
   const payerEmail = data.payer.email_address;
   let currCoins = amount * 100
   const session = await usersModel.startSession()
   try {
     await session.withTransaction(async()=> {
       await usersModel.updateOne({userId},{$inc:{userCoins: currCoins}},{session})
       await coinsPurchasesModel.updateOne({link},
         {$set:{completed: true,amount: amount, payerEmail: payerEmail}},{session})
     })
   }catch(e){
     return res.json({type:'ERROR',msg:"something went wrong"})
   } finally {
      session.endSession()
   }

   return res.json({type:'SUCCESS',msg:'you have successfully bought ' + (amount * 100) + ' coins'})
 } catch (e) {
   res.json({type:'ERROR',msg:'something went wrong'})
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

module.exports = coinsRouter
