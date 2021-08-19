
function validate(req, res, next) {
  if (req.session.admin !== undefined){
    next();
  }else{
    res.json({type: "ERROR",msg: "login as admin is required"})
  }
}

module.exports = validate;
