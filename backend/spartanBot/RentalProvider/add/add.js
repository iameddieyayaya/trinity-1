require('dotenv').config();
const fs = require('fs');
const fsPromise = fs.promises;
const storage = process.cwd() +'/localStorage/spartanbot-storage';

/**
 * Create a pool and add it to local variable
 * @param {Object} options.poolData
 * @param {string} options.poolData.type - Pool algo, eg: sha256, scrypt, x11, etc
 * @param {string} options.poolData.name - Name to identify the pool with
 * @param {string} options.poolData.host - Pool host, the part after stratum+tcp://
 * @param {number} options.poolData.port - Pool port, the part after the : in most pool host strings
 * @param {string} options.poolData.user - Your workname
 * @param {number} [options.poolData.id] - Local ID (NOT MRR ID)
 * @param {string} [options.poolData.pass='x'] - Worker password
 * @param {string} [options.poolData.notes] - Additional notes to help identify the pool for you
 * @async
 * @returns {Promise<Object>}
 */

let addPool = async function(setup_success, options) {
    const provider = setup_success.proivder || setup_success
    console.log('provider: 23', provider)
    let poolData;
    try {
        //MRRProvider.js in spartanbot creates pool profile on MMR site
        poolData = await provider.createPoolProfile( options.poolData.name, options.poolData.type );

    } catch (err) {
        console.log(`Error while creating the profile: ${err}`);
        return {
            provider: 'MiningRigRentals',
            err: 'pool',
            message: `Error while creating the profile: ${err}`,
            pool: false,
            credentials: true,
            success: false
        }
    }
    

    if ( poolData && poolData.success && poolData.data.id ) {
        provider.setActivePoolProfile( poolData.data.id );
        this.serialize()

        for (let p of this.getRentalProviders()) {
            if ( p.getUID() !== provider.getUID() ) {
                p._addPools(options.poolData);  // Line is not working, was .addPools and not _addPools method, 
                                                //but still doesn't make sence, added options.poolData
            }
        }
        try {
            let pool = await provider._createPool(options.poolData)
            if ( pool.error ) {
                console.log(`Error while creating the profile: ${pool.error}`);
                
                console.log(`Pool successfully added add.js line#54 ${poolAdded}`);
                return {
                    provider: 'MiningRigRentals',
                    err: 'pool',
                    message: `Error while creating the pool: ${pool.error}`,
                    pool: false,
                    credentials: true,
                    success: false
                }
            } else {
                return {
                    rental_provider: 'MiningRigRentals',
                    message: `Mining Rig Rental and Pool successfully added, \n` + 
                             `pool id:${pool.mrrID}`,
                    pool: true,
                    credentials: true,
                    success: true
                }
            }
        } catch(e) {
            console.log({err: 'Pool unsuccessful add.js line 76' + e})
            return {err: 'Pool unsuccessful' + e}
        }
    } else {
        if (poolData === null || poolData === undefined) {
            console.log(`Profile unsuccessfully added. Pool Data: ${poolData}`)
            return {
                provider: 'MiningRigRental',
                err: 'pool',
                message: `Profile unsuccessfully added. Profile data: ${poolData}`,
                pool: false,
                credentials: true
            }
        }
    } 
}

/**
 * Gets the current class from spartanbot MRRProvider NiceHashProvider
 * @param {Object} options
 * @param {Object <MRRProvider NiceHashProvider>} this - spartan.getRentalProviders()
*/

const getCurrentProvider = function(options) {
    console.log('THIS ',this)
    if (this.length) {
        return this.filter(provider => {
            if ( provider.name === options.provider) {
                console.log('provider: NAME NAME', provider)
                return provider
            }
        })[0]
    }
}

/**
 * Delete a pool
 * @param {(number|string)} id - Pool id
 * @returns {Promise<*>}
 */
const deletePool = async function(id){
    let deletedPool = await this.deletePool().then(res => console.log('deletedPool: ',res))
}

/**
 * Delete a pool profile
 * @param {(number|string)} id - Profile id
 * @returns {Promise<Object>}
 */
const deletePoolProfile = async function(id = '') {
    let deletedPoolProfile = await this.deletePoolProfile(id).then(res => console.log('deletedPoolProfile: ',res))
}


const {
    Prompt_AddOrCreatePool,
    Prompt_AddPool,
    Prompt_NiceHashCreatePool,
} = require('./promptFunctions');

const { fmtPool, serPool } = require('../../utils');

const MiningRigRentals = 'MiningRigRentals';
const NiceHash = 'NiceHash';

module.exports = async function(options) {
    let spartan = options.SpartanBot;
    
    /**
	 * Get all Rental Providers from SpartanBot
	 * @return {Array.<MRRProvider NiceHashProvider>} Returns an array containing all the available providers
	 */
    let rental_provider_type = options.rental_provider;
    console.log('rental_provider_type:', rental_provider_type)
    let rentalProviders = spartan.getRentalProviders();

    if (rentalProviders.length === 2 && options.poolData === undefined) {
        let poolArray = spartan.returnPools();
        return {
            err: 'provider',
            message: poolArray.length ? `Maximum number of providers reached, ${rentalProviders.length}.`: 
                        `Maximum number of providers reached, showing ${poolArray.length} pools.\n Input fields below to add one.`,
            pool: poolArray.length ? true : false,
            credentials: true,
            success: poolArray.length ? true : false
        }
    }
        
    
    //fn to check existence of a provider in MRRProvider.js
    const checkProviders = provType => {
        for (let prov of rentalProviders) {
            if (prov.getInternalType() === provType) {
                return true;
            }
        }
    };

    let poolArray = await spartan.returnPools();
    console.log('poolArray: 181', poolArray)

    if (rental_provider_type === MiningRigRentals) {
        if (checkProviders(MiningRigRentals)) {
            // No pool input data sent from user and no pools exist for user
            if (options.poolData === undefined ) {
                return {
                    err: 'pool',
                    message: poolArray.length ? 'Mining Rig Rentals account already exists \n' +
                                                'Current Limit: 1. Choose another rental provider \n' +
                                                'to add another account.' :
                                                'Mining Rig Rentals account already exists  \n' +
                                                'No pool found enter pool info below to add a pool.',
                    pool: poolArray.length ? true : false,
                    credentials: true,
                    success: poolArray.length ? true : false,
                }
            } 
            else {
                try {
                    const currentProvider = getCurrentProvider.call(rentalProviders, options)
                    const pool = await addPool.call(spartan, currentProvider ,options)
                    console.log('pool: 200', pool)
                    return pool;
                } catch (e) {
                    return {
                        err: 'pool',
                        message: 'Parse error during addPool function \n',
                        pool:  false,
                        credentials: true,
                        success: false,
                    }
                }
            }
        }
    } else if (rental_provider_type === NiceHash) {
        if (checkProviders(NiceHash)){
            // No pool input data sent from user and no pools exist for user
            if (options.poolData === undefined ) {
                console.log( `NiceHash account already exists. 'Current Limit: 1.'`);
                return {
                    err: 'pool',
                    message: 'Nice Hash account already exists. Current Limit: 1. \n'+ 
                                'No pool found enter pool info below to add a pool',
                    pool:  false,
                    credentials: true,
                    success: false,
                }
            }
        }
    }

    try {
        // Setup either NiceHash or Mining Rig Rentals and finds out if pools or rigs are added to the account also signs you in
        let setup_success = await spartan.setupRentalProvider({
            type: rental_provider_type,
            api_key: options.api_key,
            api_secret: options.api_secret,
            api_id: options.api_id,
            name: rental_provider_type
        });

        // return setup_success.provider.deletePoolProfile(100144).then(res => console.log('deletedPoolProfile: ',res))
        console.log('setup_success: top \n', setup_success.provider)


        if (setup_success.success) {
            if (setup_success.type === MiningRigRentals) {
                let poolArray = await spartan.returnPools();
                console.log('poolArray: 240', poolArray)
                console.log('setup_success poolProfiles length:', setup_success.poolProfiles.length)

                /**
                 * @param {Object} - Add profile and pool 
                 * */
                
                if ( setup_success.poolProfiles.length === 0 ) {
                    let poolData;
                    
                    //if user has no poolProfiles, prompt to create one
                    if (options.poolData === undefined){
                        return {
                            rental_provider: 'MiningRigRental',
                            err: 'pool',
                            message: `No pools found, input pool info below to continue:`,
                            pool: false,
                            credentials: true,
                            success: false
                        }
                    }
                    
                } else {
      
                    /**
                     * @param {Array} - If User wants to add another Pool, they need just their id below
                     ********   let poolToAdd = 'the id of the pool you\'re trying to add' ************
                    **/
                    if (options.poolData === undefined) {
                        console.log('options.poolData: line 269')
                        let poolProfiles = setup_success.poolProfiles;
                        console.log('poolProfiles:', poolProfiles)
                        let profileArray = [];
                        let profileIDs = [];
                        for (let profile of poolProfiles) {
                            console.log('profile:', profile.id)
                            profileArray.push(
                                `Name: ${profile.name} - ID: ${profile.id}`
                            );
                            profileIDs.push(profile.id);
                        }
                      
                        for (let id of profileIDs) {
                            console.log('profileIDs:', profileIDs)
                            
                            // if (poolToAdd.includes(id)) {
                                setup_success.provider.setActivePoolProfile(id);
                                // const len = poolProfiles.length
                                // for (let i = 0; i < len; i++) {
                                // 	if (poolProfiles[i].id === id) {
                                // 		setup_success.provider.addPoolProfiles(poolProfiles[i])
                                // 	}
                                // }
                            // }
                        }
                       
                
                        spartan.serialize();
                        return {
                            rental_provider: 'MiningRigRental',
                            err: 'pool',
                            message: `Profile successfully added, profile id(s): ${profileIDs} \n`+
                                     `You have ${setup_success.pools.length} pool(s), fill out pool info below \n`+
                                     `to add another or click continue`,
                            pool: false,
                            credentials: true,
                            success: true
                        }
                    } else {
                        /**
                         * RAN ONLY IF USER HAS A PROVIDER ADDED BUT DOESN'T HAVE A POOL.
                         */
                        try {
                            const currentProvider = getCurrentProvider.call(rentalProviders, options)
                            const pool = await addPool.call(spartan, currentProvider ,options)
                            console.log('pool: 200', pool)
                            return pool;
                        } catch (e) {
                            return {
                                err: 'pool',
                                message: 'Parse error during addPool function \n',
                                pool:  false,
                                credentials: true,
                                success: false,
                            }
                        }
                    }
                }
            }
            if (setup_success.type === 'NiceHash') {
                
                console.log('setup_success.provider:', setup_success.provider)
                let poolOptions = await Prompt_AddOrCreatePool(
                    setup_success.provider
                );
                if (poolOptions.option === 'add') {
                    let poolArray = await spartan.returnPools();

                    //if on pools, ask if they want to create one
                    if (poolArray.length === 0) {
                        let confirm = await self.prompt({
                            type: 'confirm',
                            name: 'option',
                            default: true,
                            message: vorpal.chalk.yellow(
                                'Found no pools to add, would you like to create one?'
                            ),
                        });
                        if (confirm.option) {
                            //create pool
                            let NiceHashPool = await Prompt_NiceHashCreatePool(
                         
                                spartan
                            );
                            await spartan.createPool(NiceHashPool);
                            setup_success.provider.setActivePool(
                                NiceHashPool.id
                            );
                            self.log(`Pool Added`);
                        }
                    } else {
                        let fmtPoolArray = [];
                        for (let pool of poolArray) {
                            fmtPoolArray.push(fmtPool(serPool(pool), vorpal));
                        }
                        let poolPicked = await Prompt_AddPool(
                         
                            fmtPoolArray
                        );

                        let poolObject = {};
                        for (let pool of poolArray) {
                            poolObject[fmtPool(serPool(pool), vorpal)] =
                                pool.id;
                        }

                        let poolid = poolObject[poolPicked.option];
                        setup_success.provider.setActivePool(poolid);
                        for (let pool of poolArray) {
                            if (pool.id === poolid) {
                                setup_success.provider.addPools(pool);
                            }
                        }
                    }
                } else if (poolOptions.option === 'create') {
                    //Prompt create Nice Hash pool
                    let NiceHashPool = await Prompt_NiceHashCreatePool(
           
                        spartan
                    );
                    await spartan.createPool(NiceHashPool);
                    self.log(`Pool Created`);
                }
            }
            spartan.serialize();
        } else {
            if (setup_success.message === 'settings.api_key is required!') {
                console.log('You must input an API Key!')
                return {
                    err: 'credentials',
                    message: 'settings.api_key is required!',
                    credentials: false,
                    success: false
                }
            } else if (setup_success.message === 'settings.api_secret is required!') {
                console.log('You must input an API Secret!')
                return {
                    err: 'credentials',
                    message: 'You must input an API Secret!',
                    credentials: false,
                    success: false
                }
            } else if ( setup_success.message === 'Provider Authorization Failed') {
                console.log('Unable to login to Account using API Key & API Secret, please check your keys and try again');
                return {
                    err: 'provider',
                    message: 'Unable to login to Account using API Key or API Secret,\n'+
                             'please check your credentials and try again',
                    credentials: false,
                    success: false
                }
                
            } else {
                return {
                    err: 'provider',
                    message: setup_success.message,
                    credentials: false,
                    success: false
                }
            }
        }
    } catch (e) {
      
            console.log('Error! Unable to add Rental Provider!\n' + e)
     
        return {
            err: 'provider',
            message: 'Error! Unable to add Rental Provider!\n' + e,
            credentials: false,
            pool: false,
            success: false
        }
    }
};
