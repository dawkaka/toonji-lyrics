const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const AdminsSchema = new Schema({
  userId: String,
  name: String,
  email: String,
  password: String,
});


const adminsModel = mongoose.model('admin',AdminsSchema);
module.exports = adminsModel;
