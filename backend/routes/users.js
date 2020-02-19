require('dotenv').config();
const JWT = require('jsonwebtoken');
const { JWT_SECRET } = process.env;
const express = require('express');
const router = express.Router();
const passportConf = require('../passport');

const passport = require('passport');
const passportSignIn = passport.authenticate('local', { session: false });

function authenticateToken(req, res, next) {
    console.log('header', req.headers);
    const authHeader = req.headers['authorization'];
    const token = authHeader;

    console.log('authHeader', authHeader);
    console.log('token', token);
    if (token == null) return res.sendStatus(401);

    JWT.verify(token, JWT_SECRET, (err, user) => {
        if (err) return console.log('403');

        req.body = user;
        next();
    });
}

const signUpValidator = require('../helpers/signUpValidator');

const UsersController = require('../controllers/users');

router.post('/signup', signUpValidator, UsersController.signUp);

router.post('/login', passportSignIn, UsersController.signIn);

// router.get('/secret', //Add jwt
// UsersController.secret
// );
router.get('/users', (res, req) => {
    res.sendFile('index.html');
});

module.exports = router;