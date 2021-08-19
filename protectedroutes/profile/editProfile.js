const express = require('express');
const editProfileRoute = express.Router();
const formidable = require('formidable')
const fs = require('fs');
const path = require('path')
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const validate = require('../validate');
const dataDir = `${__dirname}/data`;
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
    accessKeyId: process.env.s3Id,
    secretAccessKey: process.env.s3Key
});
editProfileRoute.post('/api/profile/edit-profile/',validate,async(req,res)=>{
  try {
  const form = new formidable.IncomingForm()
  form.parse(req,(err,fields, files)=>{
    if(err) return res.json({msg: "something went wrong"})
    const {name, bio} = fields;
    if(name === undefined || bio === undefined) {
      return res.json({type:'ERROR',msg:'Missing some body parts'})
    }
    if(name.trim() === "") {
      return res.json({type:'ERROR',msg:"name field can not be empty"})
    }
    if(bio.length > 126) {
      return res.json({type:'ERROR',
      msg:'bio can not be greater 126 characters'})
    }

    const picture = files.picture;
    if(picture !== undefined){
    let stats = fs.statSync(picture.path)
    let sizeInMb = stats.size/(1024 * 1024)
    if(sizeInMb > 3) return res.json({type:'ERROR',msg:'image file too large'})
    picture.name = Date.now() + picture.name.replace("/\W/g","");
    extNameImage = path.extname(picture.name);
    if(extNameImage != '.jpeg' && extNameImage != '.jpg' && extNameImage != '.png'){
      return res.json({msg: 'invalid image file formats'});
    }
  }
 const sessionId = req.session.user.userId;
  if(name !== req.session.user.userName){
    usersModel.find({name},(err,data)=>{
      if(err) return res.json({type:'ERROR',msg:'something went wrong'})
      if(data.length) return res.json({type:'ERROR',msg:"user name already taken"});
       usersModel.findOne({userId: sessionId},(err,data)=>{
         if(err) return res.json({type:'ERROR',msg: "database error"})
         if(data === null) return res.json({type:'ERROR',msg: "check your current username and try again"});

      let pName = (data.picture === undefined || data.picture === null) ?
           (picture === undefined)? data.picture : picture.name : data.picture

        if(picture !== undefined) {
          const fileContent = fs.readFileSync(picture.path);
           fs.unlinkSync(picture.path)
          const params = {
              Bucket: 'tunjiimages',
              Key: pName, // File name; to save as in S3
              Body: fileContent,
              ContentType: 'image/jpg',
              ACL: 'public-read'
          };
          s3.upload(params, function(err, data) {

              if (err) {
                  res.json({type:'ERROR',msg:'error uploading image'})
              }else {
                usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.json({type:'ERROR',msg: "error saving info, try again"})
                 req.session.user.userName = name
                 req.session.user.name = name
                 res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.json({type:'ERROR',msg: "error saving info, try again"})
           req.session.user.userName = name
           req.session.user.name = name
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
       })
    })
  }else {
    usersModel.findOne({userId: sessionId},(err,data)=>{
      if(err) return res.json({type:'ERROR',msg: "database error"})
      if(data === null) return res.json({type:'ERROR',
      msg: "check your current username and try again"});
      let pName = (data.picture === undefined || data.picture === null) ?
       (picture === undefined)? data.picture : picture.name : data.picture
        if(picture !== undefined) {
          const fileContent = fs.readFileSync(picture.path);
           fs.unlinkSync(picture.path)
          const params = {
              Bucket: 'tunjiimages',
              Key: pName, // File name you want to save as in S3
              Body: fileContent,
              ContentType: 'image/jpg',
              ACL: 'public-read'
          };
          s3.upload(params, function(err, data) {
              if (err) {

                  res.json({type:'ERROR',msg:'error uploading image'})
              }else {

                usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.json({type:'ERROR',msg: "error saving info, try again"})
                   res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.json({type:'ERROR',msg: "error saving info, try again"})
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
    })
  }
  })
} catch (e) {
  res.json({type:'ERROR',msg:'something went wrong'})
}
})

module.exports = editProfileRoute;
