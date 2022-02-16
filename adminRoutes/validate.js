
function validate(req, res, next) {
  if (req.session.admin !== undefined){
    next();
  }else{
    res.status(401).json({type: "ERROR",msg: "login as admin is required"})
  }
}

module.exports = validate;
