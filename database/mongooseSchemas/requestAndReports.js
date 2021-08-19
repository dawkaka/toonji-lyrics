const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const requestReportsSchema = new Schema({
  userId: String,
  rrType: String,
  rrMessage: String
})

const requestReportModel = mongoose.model("requestReport",requestReportsSchema)

module.exports = requestReportModel
