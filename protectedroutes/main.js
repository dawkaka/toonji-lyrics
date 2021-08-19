const express = require('express');
const protectedRoutes = express.Router();
const profileMainRoute = require('./profile/main');
const lyricsRouter = require('./lyrics/main');
const favouritesRouter = require('./favourites/main');
const commentsRouter = require('./comments/main');
const breakdownsRouter = require('./breakdowns/main');
const quizRouter = require('./quiz/main')
const coinsRouter = require('./coins/main')
// protectedRoutes.use(require('./validate'))
protectedRoutes.use(profileMainRoute);
protectedRoutes.use(lyricsRouter);
protectedRoutes.use(favouritesRouter);
protectedRoutes.use(commentsRouter);
protectedRoutes.use(breakdownsRouter);
protectedRoutes.use(quizRouter)
protectedRoutes.use(coinsRouter)

module.exports = protectedRoutes;
