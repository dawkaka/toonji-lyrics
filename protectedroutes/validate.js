const jwt = require("jsonwebtoken")


function validate(req, res, next) {
  if (req.session.user !== undefined){
    next();
    return
  }else {
   res.status(401).json({type: "ERROR",msg: "log in required"})
  }
}
module.exports = validate;
