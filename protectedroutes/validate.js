
function validate(req, res, next) {
  if (req.session.user !== undefined){
    return next();
  }else{
    return res.json({type: "ERROR",msg: "log in required"})
  }
}
module.exports = validate;
