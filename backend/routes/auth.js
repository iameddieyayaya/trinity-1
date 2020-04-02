require('dotenv').config();
const express = require('express');
const router = express.Router();
const passportConf = require('../passport');
const auth = require('../middleware/auth');
const passport = require('passport');
const passportCoinbase = passport.authenticate('oauth2', { session: false });
const User = require('../models/user');



router.get('/coinbase',
  passport.authenticate('coinbase', {scope: [`wallet:user:read,wallet:user:email,wallet:accounts:read,wallet:payment-methods:read,wallet:buys:read,wallet:buys:create,wallet:transactions:read,wallet:transactions:send,wallet:sells:create,wallet:withdrawals:create`]}
  ),
  function(req, res){
    // The request will be redirected to Coinbase for authentication, so this
    // function will not be called.
  });


// pass code - will spit out token
router.get('/coinbase/callback', auth, passportCoinbase, async (req, res) => {
    try {
        console.log(req);

        return res.status(201).send({ success: req.user.coinbase.accessToken });
    } catch (error) {
        console.log(error);
    }
});


router.post('/bittrex', auth, (async (req, res) => {
    try {
      
      const { apiKey, secret } = req.body;

      const user = await User.findById(req.user.id).select('-password');

      if(!user){
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(user)

      user.bittrex = {
        apiKey,
        secret
      }

      await user.save({validateBeforeSave: false})

      res.status(201).json({ success: 'Keys successfully stored!'})
    } catch (error) {
      console.log(error);
    }

}))

module.exports = router;