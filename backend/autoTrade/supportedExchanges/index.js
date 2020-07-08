require('dotenv').config();
const { API_URL}  = process.env
const { Account, Address, TransactionBuilder, Networks } = require('@oipwg/hdmw')
const { log }= require('../../helpers/log')
const uuidv4 = require('../../helpers/uuidv4');
const {
    getTotalQty,
    getOfferPriceBtc,
    getSellableQty,
    getProfitUsd,
    getRentalBudget3HrCycleUsd,
    getRentalBudgetDailyUsd,
    getTakeProfitBtc,
    getCoinbaseBTCUSD,
    getBittrexBtcUsd,
    getPriceBittrexBtcToken,
    getBlockHeightFlo,
    getBlockHeightRvn,
    getBalanceFromAddress,
    getFees,
    checkMarketPrice,
    getTxidInfo,
    getMinTradeSize,
    getCurrencyInfo
} = require('./func')
const bip32 = require('bip32')
const axios = require('axios')


const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;


module.exports = async function(profile, accessToken, wallet, rentalAddress, name, duration) {
let {
    address,
    token,
    targetMargin,
    profitReinvestment,
    updateUnsold,
    dailyBudget,
    _id,
    CostOfRentalBtc
} = profile

let MIN_FEE_PER_BYTE = 0;
let BLOCK_EXPLORER = ''
    switch(token){
        case 'FLO':
            BLOCK_EXPLORER = 'https://livenet.flocha.in'
            MIN_FEE_PER_BYTE = 0.00000001
            break;
        case 'RVN':
            BLOCK_EXPLORER = `https://main.rvn.explorer.oip.io`
            MIN_FEE_PER_BYTE = .0000001
            break;
    }
const ID = uuidv4();
const DURATION = duration
let coin = token.toLowerCase();
    if(coin === 'rvn' ){
        coin = 'raven'
    }
let currency = await getCurrencyInfo(token)
let minConfirmations = currency.minConfirmations;
const MIN_TRADE_SIZE = await getMinTradeSize(token)


let TotalQty  = 0; //Receviced + FeeFloTx1
let ReceivedQty; //what is deposited from rentals
let FeeFloTx1; //cumulative fee from rentals.
// These values come from what resulted in the rentals;

let SellableQty; //Qty to sell; TotalQty - FeeFloTx2
let FeeFloTx2; //Fee from moving tokens from Local Wallet to Bittrex

let  OfferPriceBtc, //formula 
     CostOfRentalBTC, //comes from rental
     EstFeeBtcTx1, //?
     BtcFromTrades = 0,
     PriceBtcUsd,
     ProfitUsd,// = ( BtcFromTrades * PriceBtcUsd ) - CostOfRentalUsd
     RentalBudget3HrCycleUsd,
     CostOfRentalUsd,
     totalSent = 0;

const CostOfWithdrawalPerCycleBTC = 0.0005;
const TradeFee= .002
let FloTradeFee;
let checkBlock;
let currentBlockCount;
let orderReceiptID = ''
let BtcFromsPartialTrades = 0;

let TokensFromCanOffer,
    costOfRentalFromCanOffer
    
    if(!accessToken){
        log(name, {ID} ,'no access token');
        return 'ERROR; No Access Token'
    }
    if(!profile){
        log(name, {ID} ,'no profile');
        return 'ERROR; Profile Not Found'
    }

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'x-auth-token': accessToken
        },
    };

    const postResults = async ({ID, _id, timestarted, costOfRentalBtc, priceBtcUsd, duration, btcFromTrades, totalMined, profitReinvestment, completedOrders}) => {
        try {

            console.log({ID, _id, timestarted, costOfRentalBtc, priceBtcUsd, duration, btcFromTrades, totalMined, profitReinvestment, completedOrders})

            let body = {
                uuid: ID,
                profile: _id,
                timestarted,
                costOfRentalBtc,
                priceBtcUsd,
                duration,
                btcFromTrades,
                totalMined,
                profitReinvestment,
                completedOrders,
            }

            axios.post(`${API_URL}/auto-trade/results`, body, config)

        } catch (error) {
            log(name, {ID}, 'postResults ---', error)
        }
    }

    const confirmBalance = async (arr) => {
        let res = await axios.get(`${API_URL}/bittrex/closed-deposits`, config)
                        
        let closedDeposits = res.data;
        
        let tokens = 0;
        
        arr.map(txid => {
                let order = closedDeposits.find(order => order.txId == txid)
    
                tokens += Number(order.quantity)
            })

        return tokens;
    }

    //bittrex wallet address
    const getBittrexAddress = async (token) => {
        try {
            
            let res = await axios.get(`${API_URL}/bittrex/deposit-addresses`, config)

            if(res.status != 200){

            }

            return res.data.bittrexAddresses[token].Address

        } catch (error) {
            log(name, {ID} ,'getBittrexAddress Failed ------- ', error)
        }
    }

    const createSellOrder = async (market, quantity, rate) => {

        if((!(market && quantity && rate))){
            return log(name, {ID} ,'Failed', {market, quantity, rate})
        }

        rate = await checkMarketPrice(rate);

                
        let body = {
            market,
            quantity,
            rate,
        }
        
        log(name, {ID} ,'running createSellOrder -------', body)


        try {
            const res = await axios.post(`${API_URL}/bittrex/createSellOrder`, body, config)

            return res.data;
        } catch (error) {
            log(name, {ID} ,'error ---', error)
        }
        
    }

    const updateOrder = async (orderUuid, market, quantity, rate) => {
        rate = await checkMarketPrice(rate);

        //check to see if order has been partially sold.
        const order = await getOrder(orderUuid)
        log(name, {ID} , {order})

        // if partially filled remove for rate - already acounter for in totalSent
        const amountSold = Number((order.Quantity - order.QuantityRemaining).toFixed(8))
        BtcFromsPartialTrades = Number((order.Price - order.CommissionPaid).toFixed(8))

        log(name, {ID} , {BtcFromsPartialTrades})

        quantity -= amountSold;

        let body = {
            orderUuid,
            market,
            quantity,
            rate,
        }

        
        log(name, {ID} ,body)

        try {
            const res = await axios.post(`${API_URL}/bittrex/updateOrder`, body, config)
            return res.data.result.uuid
        } catch (error) {
            log(name, {ID} ,'updateOrder ---', error)
        }
    }
    
    const getSalesHistory = async (token, id) => {
        try {
            if(!id){
                return log(name, {ID} , 'no:', {id})
            }

            const res = await axios.get(`${API_URL}/bittrex/salesHistory`, config)


            let {salesHistory} = res.data;

            log(name, {ID} , {id})

            const orderCompleted = salesHistory.find(el => el.OrderUuid === id)

            if(orderCompleted){
                return Number((orderCompleted.Price - orderCompleted.Commission).toFixed(8))
            } else return;

        } catch (error) {
            log(name, {ID} ,'ERR; getSalesHistory ----', error)
        }
    }

    const getOrder = async (orderUuid) => {
        try {
            const res = await axios.get(`${API_URL}/bittrex/order/${orderUuid}`, config)

            return res.data
        } catch (error) {
            log(name, {ID} ,'ERR; getOpenOrders ----', error)
        }
    }

    // Withdraw amount has to be 3 times greater than the fee (.0005 btc)
    const withdrawFromBittrex = async (currency, quantity, address) => {
        try {
            let body = {
                currency,
                quantity,
                address
            }

            log(name, {ID} , {body})
            let res = await axios.post(`${API_URL}/bittrex/withdraw`, body, config)
        
            return res.data;

        } catch (error) {
            log(name, {ID} ,'ERR; withDrawFromBittrex -----', error)
        }
    }

    const buildTransaction = async (address, amount, coin) => {
        try {

            let addressObj = new Address(address, Networks[coin], false);

            let builder = new TransactionBuilder(Networks[coin], {
                from: addressObj,
                to: {[BittrexAddress]: amount}
            }, account)
            
            
            let iof = await builder
                    .buildInputsAndOutputs()
                    .then((calculated) => {
                        return calculated;
            })
    
    
            let fee = iof.fee * MIN_FEE_PER_BYTE;

            const adjustedAmount = Number((amount - fee).toFixed(8))

            let builder2 = new TransactionBuilder(Networks[coin], {
                from: addressObj,
                to: {[BittrexAddress]: adjustedAmount}
            }, account)
    
    
            let inNOuts = await builder2
                    .buildInputsAndOutputs()
                    .then((calculated) => {
                        return calculated;
            })
        
            return Number((inNOuts.fee * MIN_FEE_PER_BYTE).toFixed(8))
        } catch (error) {
            log(name, {ID} ,'ERR; builTransaction ------', error)
        }

    }


    const checkBittrexDeposit = async (txId) => {
        try {
            const res = await axios.get(`${API_URL}/bittrex/deposit/${txId}`, config)

            if(res.data){
                return res.data
            } else {
                log(res)
            }

        } catch (error) {
            log({error})
        }
    }

    const sendPayment = async (BittrexAddress, address, amount, coin) => {
        try {

            if(amount <= 0){
                return " ----------- NO BALANCE -------------"
            }

            let fee = await buildTransaction(address, amount, coin)

            let sendAmount = Number((amount - (fee)).toFixed(8))

            let txid = await account.sendPayment({
                to: {[BittrexAddress]: sendAmount},
                from: address,
                discover: true
            })

            log({txid})

            return txid

            
        } catch (error) {
            log(name, {ID} , "ERR; SendPayment", error)
        }
    }

    const pushTokensToBittrex = async () => {
        let res = await getBalanceFromAddress(userAddress)

        if(res.balance){
            
        }


    }
    
    // ------------  START -------------- 






    //! TESTING
        CostOfRentalBtc = 0
        let price = await getCoinbaseBTCUSD()
        let priceBtcAtStart = await getCoinbaseBTCUSD()
    //! TESTING

    if(!profile){
        log(profile, 'not found')
        return 'no profile found'
    }

    const accountMaster = bip32.fromBase58(wallet[coin].xPrv, Networks[coin].network)
    let account = new Account(accountMaster, Networks[coin]);
    account.discoverChains();
    const margin = targetMargin / 100;
    const reinvestmentRate = profitReinvestment / 100;
    const BittrexAddress = await getBittrexAddress(token);
    const costOfRentalUsd = CostOfRentalBtc * price

    let userBTCAddress = address.btcAddress;
    let userAddress = address.publicAddress;
    
    log(name, {ID} , 'START AUTO TRADE', {userAddress, userBTCAddress, rentalAddress})

    if(!address){
        log(name, {ID} ,'no address')
        return 'No Address'
    }

    const timerInt = () => setInterval(() => {
        return context.currentTime = Date.now() 
        }, 1000)

    let context = {
        btcFromOrders: 0,
        bittrexBalance: 0,
        pendingBalance: 0,
        confirmedBalance: 0,
        duration: DURATION,
        hour: 1,
        blockHeight: 0,
        receivedQty: 0,
        feeFloTx1: 0,
        hourlyCostOfRentalBtc: 0,
        totalQty: 0,
        feeFloTx2: 0,
        sellableQty: 0,
        bittrexTradeFee: 0.002,
        bittrexWithdrawlFee: .0005,
        estFeeBtcTx1: 0.00001551,
        offerPriceBtc: 0,
        offerPriceBtc24h: 0,
        bittrexTxid: [],
        orders: [],
        completedOrders: [],
        currentOrder: null,
        startTime: Date.now(),
        currentTime: timerInt()
      }

      log(name, {ID}, {costOfRentalUsd, priceBtcAtStart})


    const machine = {
          state: "START",
          transitions: {
              "START": {
                  starting: async function() {
                    log(name, {ID}, 'Staring...')

                    let {balance, transactions} = await getBalanceFromAddress(userAddress)
                    let fees = await getFees(transactions);
                    context.receivedQty = balance;
                    context.feeFloTx1 = fees
                    context.hourlyCostOfRentalBtc = Number((costOfRentalUsd / context.duration / priceBtcAtStart).toFixed(8))
                    context.totalQty = getTotalQty(context.receivedQty, context.feeFloTx1)
                    log(name, {ID}, context)
                    // this.changeState('TRANSFER')
                    // this.dispatch('moving')
                  },
                  
              },
              "TRANSFER": {
                  moving: async function() {

                    if(context.receivedQty <= 0){
                        log(name, {ID}, "NO BALANCE ---")
                        //wait... go back to start
                        return setTimeout(() => {
                            this.changeState("START")
                            this.dispatch("starting")
                        }, (ONE_HOUR / updateUnsold)) //! UPDATEUNSOLD 
                        //have this go to an idle state. wait. try go back to start??
                    }
                    let txid = await sendPayment(BittrexAddress, userAddress, context.receivedQty, coin)
                    
                    log(name, {ID}, txid)

                    if(txid){
                        context.bittrexTxid.push(txid)

                        setTimeout(async () => {
                            let { fees } = await getTxidInfo(txid)
                            context.feeFloTx2 = fees;
                            context.bittrexBalance += (context.receivedQty - fees)
                            context.sellableQty = getSellableQty(context.totalQty, context.feeFloTx2);
                            log(name, {ID}, {fees, context})
                            this.changeState("WAIT")
                            this.dispatch("waiting")
                        }, 10000)
                    }
                  }
              },
              "WAIT": {
                  waiting: function() {
                      let timer = setInterval(async () => {
                        try {
                            
                            // let { confirmations } = await getTxidInfo(context.bittrexTxid[context.bittrexTxid.length - 1])
                            let res = await checkBittrexDeposit(context.bittrexTxid[context.bittrexTxid.length - 1])

                            let confirmations = res[0].confirmations

                            if(confirmations >= minConfirmations){
                                log("CONFIRMED", `${confirmations} out of ${minConfirmations}`)
                                clearInterval(timer)
                                this.changeState("CHECK_DEPOSIT")
                                this.dispatch("checkingDeposits")

                            } else {
                                log(name, {ID}, {confirmations})
                            }
                        } catch (error) {
                            log(error)
                        }
                      }, ONE_MINUTE )
                  }
              },
              "CHECK_DEPOSIT": {
                  checkingDeposits: async function() {
                    let depositInt = setInterval(async () => {
                        let res = await checkBittrexDeposit(context.bittrexTxid[context.bittrexTxid.length - 1])

                        log("deposit", {res})

                        let order =  res.find(order => order.txId === context.bittrexTxid[context.bittrexTxid.length - 1])

                        let bal = await confirmBalance(context.bittrexTxid)
                        console.log('confirmed bal', bal)

                        console.log({order})

                        let status = order.status

                        if(status === "COMPLETED") {
                            clearInterval(depositInt)
                            this.changeState("CALC")
                            this.dispatch("calculating")
                        } else {
                            log(name, {ID}, {res})
                        }
                    }, ONE_MINUTE)
                  }
              },
              "CALC": {
                calculating: function() {
                    let {
                        hourlyCostOfRentalBtc,
                        sellableQty,
                        bittrexTradeFee,
                        bittrexWithdrawlFee,
                        estFeeBtcTx1,
                        } = context
                    context.offerPriceBtc = getOfferPriceBtc(hourlyCostOfRentalBtc, bittrexTradeFee, margin, bittrexWithdrawlFee, estFeeBtcTx1, sellableQty)


                    if(context.currentOrder){
                        this.changeState("UPDATE_UNSOLD")
                        this.dispatch("checkingStatus")
                    } else {
                        this.changeState("CREATE_OFFER")
                        this.dispatch("creatingOffer")
                    }

                }
              },
              "CREATE_OFFER": {
                creatingOffer: async function() {


                    
                    if(context.bittrexBalance >= MIN_TRADE_SIZE){
                        const res = await createSellOrder(token, context.bittrexBalance, context.offerPriceBtc);

                        if(res.success){
                            context.orders.push(res.result)
                            context.currentOrder = (res.result.uuid)
                            log(context)
                            this.changeState("UPDATE_UNSOLD")
                            this.dispatch("checkingStatus")
                        } else {
                            log({res}, `---- HANDLE THIS`);
                            // this.changeState("")
                        }

                        
                    } else {
                        log({MIN_TRADE_SIZE}, '---- NOT MET', )
                            this.changeState("START")
                            this.dispatch("starting")

                    }


                }
              },
              "UPDATE_UNSOLD": {
                    checkingStatus: async function() {
                        log('checkingSatus')

                        if(context.hour === 1){
                            return setTimeout(() => {
                                this.changeState("LOOP")
                                this.dispatch("looping")
                            }, ONE_HOUR) //! ONE_HOUR
                            
                        }

                        console.log({context}, 'derppppp---')

                        let orderStatus = await getOrder(context.currentOrder)

                        console.log({orderStatus})

                        if(orderStatus.fillQuantity == "0.00000000"){
                            return this.dispatch('notPartiallyMet', [{orderStatus}])
                        } else if (orderStatus.fillQuantity > 0){
                            return this.dispatch("partiallyMet", [{orderStatus}])
                        } else if (orderStatus.quantity == orderStatus.fillQuantity){
                            return this.dispatch("fullyMet", [{orderStatus}])
                        } else {
                            log("Uuh Ooh")
                        }

                    },
                    notPartiallyMet: async function({orderStatus}) {
                        log('notPartiallyMet', orderStatus)

                        let tokenFromCancelledOffer = orderStatus.quantity
                        let costOfRentalFromCancelledOffer = context.hourlyCostOfRentalBtc * (context.hour - 1)
                        let costOfRentalBtcHour = context.hourlyCostOfRentalBtc;
                        let sellableQty = (tokenFromCancelledOffer + (context.receivedQty + context.feeFloTx1) - context.feeFloTx2)
                        let offerPriceBtc = ( 
                            ( costOfRentalFromCancelledOffer + costOfRentalBtcHour ) * ( context.bittrexTradeFee + 1 ) * (margin + 1 )
                             + ((CostOfWithdrawalPerCycleBTC + context.estFeeBtcTx1) / 24) ) / sellableQty

                        log({tokenFromCancelledOffer, costOfRentalFromCancelledOffer, sellableQty, offerPriceBtc})

                        let qty = orderStatus.quantity + context.bittrexBalance

                        log("UPDATE OFFER ----> ", offerPriceBtc)
                        let res = await updateOrder(context.currentOrder, token, qty, offerPriceBtc)
                            log({res})

                            if(res.success){
                            context.orders.push(res.result)
                            context.currentOrder = (res.result.uuid)
                            log(context)
                            this.changeState("LOOP")
                            this.dispatch("looping")
                        } else {
                            log({res}, `---- HANDLE THIS`);
                            // this.changeState("")
                        }
                        

             },
                    partiallyMet: async function ({orderStatus}) {
                        log("MADE IT TO PARTIALLY_MET", {orderStatus})

                        let unsold = (orderStatus.quantity - orderStatus.fillQuantity)
                        let percentOfCancelledPartialOfferThatWasUnsold = unsold / context.totalQty
                        let costOfRentalFromPartialCancelledOffer = percentOfCancelledPartialOfferThatWasUnsold * context.hourlyCostOfRentalBtc * (context.hour - 1)
                        let costOfRentalBtcHour = context.hourlyCostOfRentalBtc
                        let sellableQty = (tokenFromCancelledOffer + (context.receivedQty + context.feeFloTx1) - context.feeFloTx2)
                        let offerPriceBtc = ( (
                            costOfRentalFromPartialCancelledOffer + costOfRentalBtcHour) * ( context.bittrexTradeFee + 1 ) * ( margin + 1 )
                             + ( ( CostOfWithdrawalPerCycleBTC + context.estFeeBtcTx1 ) / 24 ) ) / sellableQty;

                        let qty = unsold + context.bittrexBalance

                        log("UPDATE OFFER ----> ", offerPriceBtc)
                        let res = await updateOrder(context.currentOrder, token, qty, offerPriceBtc)
                           log({res})

                            if(res.success){
                            context.orders.push(res.result)
                            context.currentOrder = (res.result.uuid)
                            log(context)
                            this.changeState("LOOP")
                            this.dispatch("looping")
                        } else {
                            log({res}, `---- HANDLE THIS`);
                            // this.changeState("")
                        }
                        
                    },
                    fullyMet: function ({orderStatus}) {
                        log("MADE IT TO FULLY MET", {orderStatus})
                        context.completedOrders.push(orderStatus)
                        let offerPriceBtc = getOfferPriceBtc(hourlyCostOfRentalBtc, bittrexTradeFee, margin, bittrexWithdrawlFee, estFeeBtcTx1, sellableQty)
                        
                        context.offerPriceBtc = offerPriceBtc;
                 
                        log("CREATE OFFER ----> ", offerPriceBtc)
                        this.changeState("CREATE_OFFER")
                        this.dispatch("creatingOffer")                        

                    }
              },
              "LOOP": {
                looping: function() {
                    log("LOOOPPPPINGGGGGGG!!", {context}, Date.now())

                    if(Date.now() > (context.timestarted + (context.duration * ONE_HOUR))){
                        log('it hit this should this chage state????')
                    }

                    if(context.hour < context.duration){
                        context.hour += 1;
                        this.changeState('START')
                        this.dispatch('starting')
                    } else if (context.hour > context.duration){
                        this.changeState('CLOSE')
                        this.dispatch('closing')
                    }
                }
              },
              "CLOSE": {
                  closing: async function() {

                        let res = await axios.get(`${API_URL}/bittrex/closed-orders`, config)
                        
                        let closedOrders = res.data;
                        
                        let btcBalance = 0;

                        context.completedOrders.map(uuid => {
                                let order = closedOrders.find(order => order.id == uuid)

                                btcBalance += (order.proceeds - order.commission)
                            })

                        context.btcFromOrders = btcBalance;

                        // profitUsd = (btcFromTrade * priceCoinbaseUsdBtc) - costOfRentalUsd
                        // takeProfitBtc = profitUsd * (1 - profitReinvestmentRate) / priceCoinbaseUsdBtc

                        this.changeState('WITHDRAWL')
                        this.dispatch('withdrawing')

                  }
              },
              "WITHDRAWL": {
                withdrawing: async function() {
                    //Move btc to HDMW

                    //Move takeProfitBtc to coinbase

                    //Move left over btcFromTrade back to rental provider.
                    try {
                        let sentToHDMW = await withdrawFromBittrex('BTC', contect.btcFromOrders, rentalAddress);
                        log({sentToHDMW})

                        if(sentToHDMW){
                            this.changeState('RESULTS')
                            this.dispatch('results')
                        }
                    } catch (error) {
                        log(error)
                    }
                }
              },

              "RESULTS": {
                  results: function() {
                      postResults({
                        ID, _id, timestarted: context.startTime, 
                        costOfRentalBtc: CostOfRentalBtc, duration: DURATION, 
                        priceBtcUsd: priceBtcAtStart,
                        btcFromTrades: context.btcFromOrders, 
                        totalMined: context.totalQty, profitReinvestment, 
                        completedOrders: context.completedOrders
                    })

                  }
              },
              "ERROR": {
                  nothing: async function() {
                      return "!COOLBEANS :( "
                  }
              }
          },
          dispatch (actionName, ...payload) {
              const actions = this.transitions[this.state];
              const action = this.transitions[this.state][actionName]

              if(action){
                  action.apply(machine, ...payload);
              } else {
                  log('not valid for current state')
              }
          },
          changeState(newState){
              log('STATE ---', newState, '---' )
              this.state = newState;
          }
      }

      let Trade = Object.create(machine, {
          name: {
              writable: false,
              enumerable: true,
              value: 'Trade'
          }
      })

      log("CURRENT STATE ---", Trade.state)
    //   Trade.dispatch("starting")

      let pushTokensInt = setInterval(() => {
          pushTokensToBittrex()
      }, (5 * ONE_MINUTE)) //! ONE HOUR




    return;
}
