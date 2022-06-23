const usersRoutes = require('express').Router()
const usersModel = require('../../database/mongooseSchemas/usersSchema')
const formidable = require('formidable')
const fs = require('fs');
const validate = require('../validate');
const path = require('path')
const requestReportModel = require('../../database/mongooseSchemas/requestAndReports')
const s3 = require("../../libs/aws")

usersRoutes.post('/api/c/request/:id',validate,async(req,res)=> {
  try {
    const request = await requestReportModel.findOne({_id:req.params.id},{userId:1})
    if(!request) return res.status(400).json({type:'ERROR',msg:'request not found'})
    await usersModel.updateOne({userId: request.userId},{$set:{isContributor: true},
      $push:{"notifications.others": "contributor request accepted"}})
    await requestReportModel.deleteOne({_id:req.params.id})
    res.json({type:'SUCCESS',msg:'request accepted'})
  } catch (e) {

    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})

usersRoutes.delete('/api/c/request/:id',validate,async(req,res)=> {
 try {
   const request = await requestReportModel.deleteOne({_id:req.params.id})
   res.json({type:'SUCCESS',msg:'deleted'})
 } catch (e) {

   res.statu(400).json({type:'ERROR',msg:"something went wrong"})
 }
})

usersRoutes.post('/api/c/users/create-verified-profile',validate,async (req,res)=>{
  const form = new formidable.IncomingForm()
  form.parse(req,async (err,fields, files)=>{
    if(err) return res.status(400).json({type:'ERROR',msg: "something went wrong"})
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
    if(!isValidArtistName(name)){
      return res.status(400).json({type:'ERROR',msg:'invalid artits name'})
    }
    let alreadyCreated = await usersModel.findOne({name})
    if(alreadyCreated !== null) {
      return res.status(400).json({type:'ERROR',msg:'user already exists'})
    }
    const picture = files.picture;
    if(picture === undefined){
      return res.status(400).json({type:'ERROR',msg:'picture is required'})
    }
    let stats = fs.statSync(picture.path)
    let sizeInMb = stats.size/(1024 * 1024)
    if(sizeInMb > 3) return res.status(400).json({type:'ERROR',msg:'image file too large'})
    picture.name = Date.now() + picture.name.replace('/\W/g','');
    extNameImage = path.extname(picture.name);
    if(extNameImage != '.jpg'){
      return res.status(400).json({type:'ERROR', msg: 'invalid image file formats'});
    }

    const fileContent = fs.readFileSync(picture.path);
     fs.unlinkSync(picture.path)
    const params = {
        Bucket: 'tunjiimages',
        Key: picture.name, // File name you want to save as in S3
        Body: fileContent,
        ContentType: 'image/jpg',
        ACL: 'public-read'
    };
    s3.upload(params, function(err, data) {
        if (err) {
            res.status(400).json({type:'ERROR',msg:'error uploading image'})
        }else {
          usersModel.findOne({name},(err,user)=>{
            if(user === null) {
              let newArtist = new usersModel({
                name: name,
                bio: bio,
                userId: generateID(),
                picture: picture.name,
                verified: true
              }).save((err,result)=> {
                if(err) {

                  return res.status(500).json({type:'ERROR',msg:'something went wrong'})
                }
                res.json({type:'SUCCESS',msg:'new artist added'})
              });
            }else {
              res.status(409).json({type:'ERROR',msg:'artist already exist'})
            }
          })
        }
    });
  })
})

function isValidArtistName(name){
    name = name.split(' ')
    for(let i = 0; i < name.length; i++) {
     if(name[i][0] !== undefined){
      if(name[i][0].toUpperCase() !== name[i][0]) {
        return false;
      }
    }
    }
    return true;
}

function generateID() {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
  let str = '';
  for(let i = 0; i < 11; i++) {
    str += chars[Math.floor((Math.random() * (chars.length)))];
  }
  return str
}


usersRoutes.get('/api/users/:userName',validate,async(req,res)=> {
      try {
        let userName = req.params.userName;
        const users = await usersModel.find({name:{$regex:"^"+userName,$options:'i'}},{name:1,picture:1,verified:1,bio:1})
        users = users.map(user => {
          user.picture = process.env.IMAGEURL + users.picture
          return user
        })
        return res.json(users)
      } catch (e) {
        return res.status(500).json({type:'ERROR',msg:'something went wrong'})
      }
})

usersRoutes.post('/api/users/verify/:userName',validate,async(req,res)=> {
  try {
      let userName = req.params.userName;
      let userExists = await usersModel.findOne({name: userName})
      if(userExists !== null) {
        let re;
        if(!userExists.verified){
          await usersModel.updateOne({name:userName},{$set: {verified: true}})
          return res.json({type:'SUCCESS',msg:'user verified'})
        }else {
          await usersModel.updateOne({name:userName},{$set: {verified: false}})
          return res.json({type:'SUCCESS',msg:'user unverified'})
        }
      }else {
        return res.status(400).json({type:'ERROR',msg:'user not does not exist'})
      }
  } catch (e) {

    res.status(500).json({type:'ERROR',msg:'something went wrong'})
  }
})




usersRoutes.post('/api/admin/profile/edit-profile',validate,async(req,res)=> {
  const form = new formidable.IncomingForm()
  form.parse(req,(err,fields, files)=>{
    if(err) return res.json({msg: "something went wrong"})
    const {name, bio, prevName} = fields;
    if(name === undefined || bio === undefined) {
      return res.status(400).json({type:'ERROR',msg:'Missing some body parts'})
    }
    if(name.trim() === "") {
      return res.status(400).json({type:'ERROR',msg:"name field can not be empty"})
    }
    if(bio.length > 126) {
      return res.status(400).json({type:'ERROR',msg:'bio can not be greater 126 characters'})
    }
    const picture = files.picture;
    if(picture !== undefined){
      let stats = fs.statSync(picture.path)
      let sizeInMb = stats.size/(1024 * 1024)
      if(sizeInMb > 3) return res.status(400).json({type:'ERROR',msg:'image file too large'})
    picture.name = Date.now() + '-' + picture.name.replace("/\W/g","");
    extNameImage = path.extname(picture.name);
    if(extNameImage != '.jpg'){
      return res.json({msg: 'invalid image file formats'});
    }
  }

  if(name !== prevName){

    usersModel.find({name},(err,data)=>{
      if(err) return res.status(500).json({type:'ERROR',msg:'something went wrong'})
      if(data.length) return res.status(409).json({type:'ERROR',msg:"user name already taken"});
       usersModel.findOne({name: prevName},(err,data)=>{
         if(err) return res.status(500).json({type:'ERROR',msg: "something went wrong"})
         if(data === null) return res.status(400).json({type:'ERROR',msg: "check your current username and try again"});
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

                  res.status(500).json({type:'ERROR',msg:'error uploading image'})
              }else {
                usersModel.updateOne({name: prevName},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
                   res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({name: prevName},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
       })
    })
  }else {
    usersModel.findOne({name: prevName},(err,data)=>{
      if(err) return res.status(400).json({type:'ERROR',msg: "something went wrong"})
      if(data === null) return res.status(400).json({type:'ERROR',msg: "check your current username and try again"});
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
                  res.status(500).json({type:'ERROR',msg:'error uploading image'})
              }else {
                usersModel.updateOne({name: prevName},{$set:{name,bio,picture: pName}},
                 (err,data)=>{
                 if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
                   res.json({type:"SUCCESS",msg:"profile updated"});
               })
            }
          })
        } else {
        usersModel.updateOne({name: prevName},{$set:{name,bio,picture: pName}},
         (err,data)=>{
         if(err) return res.status(500).json({type:'ERROR',msg: "error saving info, try again"})
           res.json({type:"SUCCESS",msg:"profile updated"});
       })
     }
    })
  }
  })
})

usersRoutes.post('/api/users/delete/:userName',validate,async(req,res)=> {
    try {
      await usersModel.deleteOne({name: req.params.userName})
      return res.json({type:'SUCCESS',msg:'user deleted'})
    } catch (e) {

      return res.status(500).json({type:'ERROR',msg:'something went wrong'})
    }
})

module.exports = usersRoutes;
