const express = require('express');
const profileMainRoute = express.Router();
const profileRoute = require('./profile')
const editProfileRoute = require('./editProfile');

profileMainRoute.use(profileRoute);
profileMainRoute.use(editProfileRoute);

module.exports = profileMainRoute;
