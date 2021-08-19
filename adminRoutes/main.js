const express = require('express');
const adminRoutes = express.Router();
const lyricsRouter = require('./lyrics/main');
const usersRouter = require('./users/main')

adminRoutes.use(lyricsRouter)
adminRoutes.use(usersRouter)

module.exports = adminRoutes;
