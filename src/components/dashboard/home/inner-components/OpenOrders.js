import React, { useState, useEffect } from 'react';
import { formatToDate , formatTime} from '../../../../helpers-functions/dateFormatter';
import { connect } from 'react-redux';
import {getOpenOrder} from '../../../../actions/bittrexActions'



const OpenOrders = (props) => {
    console.log(props)

    useEffect(() => {
        props.getOpenOrder();
}, [props.user])


    const [fakeData, setFakeData] = useState({
        data: [
            {
                date: Date.now(),
                numOfFlo: 43.324,
                amountOfFlo: 21,
                margin: 10,
                revenue: '20',
            },
            {
                date: Date.now(),
                numOfFlo: 43.324,
                amountOfFlo: 21,
                margin: 10,
                revenue: '20',
            },
            {
                date: Date.now(),
                numOfFlo: 43.324,
                amountOfFlo: 21,
                margin: 10,
                revenue: '20',
            },
        ],
    });

    console.log(props.openOrders)

    const renderTableData = () => {
               if(!props.openOrders){
            return;
        }


        for(const k in props.openOrders){
            let x = props.openOrders[k]

            let price = (x.Quantity * x.Limit).toFixed(8); 
            switch(x.Exchange){
                case 'BTC-FLO': {
                    return (
                        <tr key={x.OrderUuid}>
                        <td>{formatToDate(x.Opened) + ' ' + formatTime(x.Opened)}</td>
                        <td>{x.Quantity}</td>
                        <td>${x.Price || price}</td>
                        {/* <td>{margin}%</td>
                        <td>${revenue}</td> */}
                        {/* <td><a href={link}>view</a></td> */}
                        </tr>
                    )
                }
            }


        }
    }

    const renderTableHeader = () => {
        // let header = Object.keys(fakeData.students[0]);
        // return header.map((key, i) => {
        //     return <th key={i}>{key.toUpperCase()}</th>;
        // });

        return (
            <>
                <th scope="col">Open Date</th>
                <th scope="col"># of FLO</th>
                <th scope="col">$ per FLO</th>
                <th scope="col">Margin</th>
                <th scope="col">Revenue</th>
            </>
        );
    };

    return (
        <div className="card open-orders">
            <div className="card-header">Open Orders</div>
            <div className="card-body">
                <table className="table table-bordered" id="open-orders">
                    <tbody>
                        <tr>{renderTableHeader()}</tr>
                        {renderTableData()}
                    </tbody>
                </table>
                <a href="#">Show More</a>
            </div>
        </div>
    );
};

const mapStateToProps = state => {
    return {
        error: state.error,
        user: state.auth.user,
        account: state.account,
        openOrders: state.bittrex.openOrders
    };
};

export default connect(mapStateToProps, {getOpenOrder})(OpenOrders);