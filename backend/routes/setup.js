// @ts-nocheck
require('dotenv').config();
const express = require('express');
const router = express.Router();
const Client = require('../spartanBot').Client;
const User = require('../models/user');
const { getCircularReplacer } = require('../spartanBot/utils');

async function processUserInput(req, res) {
    let options = req.body

    if (options.to_do === 'clearSpartanBot') {
        return options
    }

    let { userId, rental_provider } = options

    try {
        const user = await User.findById({ _id: userId });
        options.userName = user.userName
        if (!user) {
            return 'Can\'t find user. setup.js line #19'
        }
        
        // Checks the database if user providerData exist for either niceHash or MiningRigRentals,
        // if it does get data so api and secret can be used. If not return false and add keys and secret
        // to database
        let isRentalProvider = rental_provider => {
            for (let provider of user.providerData) {
                if (provider.rental_provider === rental_provider) {
                    return provider
                }
            }
        }
        let newProvider = { rental_provider, api_key: options.api_key, api_secret: options.api_secret, api_id: options.api_id }
        let providerData = user.providerData;
        let providerLength = providerData.length

        // When users credentials come back wrong, UPDATE CREDENTIALS AGAIN.
        if (options.err === "credentials") {
            for (let i = 0; i < providerLength; i++) {
                if (providerData[i].rental_provider === rental_provider) {
                    providerData[i].api_key = options.api_key
                    providerData[i].api_secret = options.api_secret
                    providerData[i].api_id = options.api_id
                    user.save()
                }
            }
        }
        // When adding credentials for the first time
        else if (!user.providerData.length) {
            user.providerData.push(newProvider)
            user.save()

            // When Credentials are good & input fields don't exist get key and secret from database
        } else {
            let provider = isRentalProvider(rental_provider)
            console.log('provider:', provider)
            if (provider) {
                options.api_key = provider.api_key
                options.api_secret = provider.api_secret
                options.api_id = provider.api_id
            } else {
                user.providerData.push(newProvider)
                user.save()
            }
        }
        return options
    } catch (e) {
        return { err: 'Can\'t find user or input is wrong.' + e }
    }
}

/* POST setup wizard page */
router.post('/', async (req, res) => {
    let userInput = await processUserInput(req, res).then(data => data).catch(err => err)
    console.log('processUserInput ', userInput)

    try {

        let data = await Client.controller(userInput);
        let StringifiedData = JSON.stringify({ data }, getCircularReplacer());

        res.status(200).send(StringifiedData)
    } catch (err) {
        console.log('route setup.js line 91 catch error', err);
        res.status(500).json({ err: err })
    }
});

module.exports = router;
