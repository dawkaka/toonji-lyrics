const express = require('express');
const editProfileRoute = express.Router();
const formidable = require('formidable')
const fs = require('fs');
const path = require('path')
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const validate = require('../validate');
const dataDir = `${__dirname}/data`;
const s3 = require("../../libs/aws");

editProfileRoute.post('/api/profile/edit-profile/',validate,async(req,res)=>{
  try {
  const form = new formidable.IncomingForm()
  form.parse(req,(err,fields, files)=>{
    if(err) return res.json({msg: "something went wrong"})
    const {name, bio} = fields;
    if(name === undefined || bio === undefined) {
      return res.status(400).json({type:'ERROR',msg:'Missing some body parts'})
    }
    if(name.trim() === "") {
      return res.status(400).json({type:'ERROR',msg:"name field can not be empty"})
    }
    if(bio.length > 126) {
      return res.status(400).json({type:'ERROR',  msg:'bio can not be greater 126 characters'})
    }

    const picture = files.picture;
    if(picture !== undefined){
    let stats = fs.statSync(picture.path)
    let sizeInMb = stats.size/(1024 * 1024)
    if(sizeInMb > 3) return res.status(400).json({type:'ERROR',msg:'image file too large'})
    picture.name = Date.now() + picture.name.replace("/\W/g","");
    extNameImage = path.extname(picture.name).toLowerCase();
    if(extNameImage != '.jpeg' && extNameImage != '.jpg' && extNameImage != '.png'){
      return res.json({msg: 'invalid image file format'});
    }
  }
 const sessionId = req.session.user.userId;
  if(name !== req.session.user.userName){
    usersModel.find({name},(err,data)=>{
      if(err) return res.status(400).json({type:'ERROR',msg:'something went wrong'})
      if(data.length) return res.status(409).json({type:'ERROR',msg:"user name already taken"});
       usersModel.findOne({userId: sessionId},(err,data)=>{
         if(err) return res.status(400).json({type:'ERROR',msg: "something went wrong"})
         if(data === null) return res.status(400).json({type:'ERROR',msg: "check your current username and try again"});

      let pName = (data.picture === undefined || data.picture === null) ?
           (picture === undefined)? data.picture : picture.name : data.picture

        if(picture !== undefined) {
          const fileContent = fs.readFileSync(picture.path);
           fs.unlinkSync(picture.path)
          const params = {
              Bucket: 'toonjimages',
              Key: pName, // File name; to save as in S3
              Body: fileContent,
              ContentType: 'image/jpg',
          };
          s3.upload(params, function(err, data) {
<<<<<<< HEAD

=======
>>>>>>> fbda471ecccc60e5545faaebfd73c29555b405ec
              if (err) {
                  res.status(500).json({type:'ERROR',msg:'error uploading image'})
              }else {
                usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.status(400).json({type:'ERROR',msg: "something went wrong, try again."})
                 req.session.user.userName = name
                 req.session.user.name = name
                 res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.status(400).json({type:'ERROR',msg: "someting went wrong, try again"})
           req.session.user.userName = name
           req.session.user.name = name
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
       })
    })
  }else {
    usersModel.findOne({userId: sessionId},(err,data)=>{
      if(err) return res.status(400).json({type:'ERROR',msg: "something went wrong"})
      if(data === null) return res.status(400).json({type:'ERROR',
      msg: "check your current username and try again"});
      let pName = (data.picture === undefined || data.picture === null) ?
       (picture === undefined)? data.picture : picture.name : data.picture
        if(picture !== undefined) {
          const fileContent = fs.readFileSync(picture.path);
           fs.unlinkSync(picture.path)
          const params = {
              Bucket: 'toonjimages',
              Key: pName, // File name you want to save as in S3
              Body: fileContent,
              ContentType: 'image/jpg',
          };
          s3.upload(params, function(err, data) {
              if (err) {

                  res.status(400).json({type:'ERROR',msg:'error uploading image'})
              }else {

                usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
                   res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({userId: sessionId},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
    })
  }
  })
} catch (e) {
  res.status(500).json({type:'ERROR',msg:'something went wrong'})
}
})

module.exports = editProfileRoute;
