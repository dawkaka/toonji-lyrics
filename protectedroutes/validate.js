const jwt = require("jsonwebtoken")


function validate(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (req.session.user !== undefined){
    next();
   return
  }else if (token) {
   jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
   if (err) return res.status(401).json({type:'ERROR',msg: "invalid or expired token"})
    req.session.user =  user
    next()
    return
  })
}else {
  res.status(401).json({type: "ERROR",msg: "log in required"})
  return
}
}
module.exports = validate;
