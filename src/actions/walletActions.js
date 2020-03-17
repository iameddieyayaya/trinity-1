// import axios from 'axios';

// Might not need this
import { decrypt } from '../helpers/crypto';
import HDMW from '@oipwg/hdmw';
const Wallet = HDMW.Wallet;

import {
    WALLET_LOADED,
    WALLET_LOADING,
    // WALLET_ERROR,
    // WALLET_SUCCESS,
    GET_BALANCE,
    GET_EXCHANGE_RATE,
} from './types';

export const loadWallet = (encryptedMnemonic, password) => dispatch => {
    dispatch({
        type: WALLET_LOADING,
    });

    const mnemonic = decrypt(encryptedMnemonic, password);

    const getWallet = new Wallet(mnemonic, { supported_coins: ['flo'] });

    // bitcoin patch kinda - use patch for Demo
    // getWallet.setExplorerUrls({
    //     bitcoin: 'https://insight.bitpay.com/api/',
    // });
    // getWallet.addCoin('bitcoin');

    dispatch({
        type: WALLET_LOADED,
        payload: getWallet,
    });

    // axios
    //     .get(
    //         `https://api.coingecko.com/api/v3/simple/price?ids=flo%2Cbitcoin%2Cravencoin%2Clitecoin&vs_currencies=usd`
    //     )
    //     .then(res => {
    //         dispatch({
    //             type: GET_EXCHANGE_RATE,
    //             payload: res.data,
    //         });
    //     });

    getWallet.getCoinBalances().then(res => {
        dispatch({
            type: GET_BALANCE,
            payload: res,
        });
    });

    getWallet.getExchangeRates(['flo', 'litecoin'], 'usd').then(res =>
        dispatch({
            type: GET_EXCHANGE_RATE,
            payload: res,
        })
    );
};
