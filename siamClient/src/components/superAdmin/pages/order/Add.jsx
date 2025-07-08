
import React from "react";
import './order.css';
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";

export default function Add() {

  const [ data , setData] = useState()

  const handleChange = () =>{

  }
 
  const [count, setCount] = useState(0);
  const IncNum = () => {
    setCount(count + 1);
  };
  const DecNum = () => {
    if (count > 0) setCount(count - 1);
    else {
      setCount(0);
    }
  };

  return (
    <main className="main-panel">
      <div className="content-wrapper">
         <div className="manage-page">
            <div className="top-heading-title">
            <strong>Search Order</strong>
            </div>

            <div className="searchstyle searchstyle-one">
            <div className="searchinput-inner">
                <p>Customer Name</p>
                <input type="text" className="searchinput" placeholder='Jason Wills'/>
              </div>
              <div className="searchinput-inner">
                <p>Select Status</p>
                <select name="workername" id="selectstatus" className="searchinput">
                    <option value="Pending">Pending</option>
                    <option value="x">x</option>
                    <option value="y">y</option>
                    <option value="z">z</option>
                </select>
              </div>
              <div className="searchinput-inner">
                <p>Retailer</p>
                <select name="workername" id="retailer" className="searchinput">
                    <option value="Retailer">Retailer</option>
                    <option value="x">x</option>
                    <option value="y">y</option>
                    <option value="z">z</option>
                </select>
              </div>
              <div className="searchinput-inner">
                <p> Date</p>
                <input type="date" className="searchinput"/>
                <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
              </div>
            </div>
        </div>
      </div>

   <div className="content-wrapper mt-3 add_order-class">
     <div className="order-table">
        <div className="order-top-tabs filterbutton">
          <p> <strong> Add </strong> </p>
          <ul>
              <li> <button className="active"> New Orders <span>(19)</span> </button> </li>
              <li> <button onClick={handleChange} id="rushorder"> Rush Orders <span>(23)</span> </button> </li>
              <li> <button onClick={handleChange}> Modified <span>(23)</span> </button> </li>
              <li> <button onClick={handleChange}> Processing <span>(23)</span> </button> </li>
              <li> <button onClick={handleChange}> Ready for Shipment <span>(23)</span> </button> </li>
              <li> <button onClick={handleChange}> Sent <span>(23)</span> </button> </li>
          </ul>
          </div>
          <table className="table">
          <thead>
              <tr>
              <th>PRODUCT</th>
              <th>Description</th>
              <th> QTY </th>
              </tr>
          </thead>
          <tbody>
              <tr>
              <td>Longtail</td>
              <td>Short one line Description</td>
              <td><Button className="minusIc" onClick={DecNum}> - </Button> <span className="countOutput">{count}</span> <Button className="plusIc" onClick={IncNum}> + </Button> </td>
              </tr>
              <tr>
              <td>Longtail</td>
              <td>Short one line Description</td>
              <td><Button className="minusIc" onClick={DecNum}> - </Button> <span className="countOutput">{count}</span> <Button className="plusIc" onClick={IncNum}> + </Button> </td>
              </tr>
              <tr>
              <td>Longtail</td>
              <td>Short one line Description</td>
              <td><Button className="minusIc" onClick={DecNum}> - </Button> <span className="countOutput">{count}</span> <Button className="plusIc" onClick={IncNum}> + </Button> </td>
              </tr>
              <tr>
              <td>Longtail</td>
              <td>Short one line Description</td>
              <td><Button className="minusIc" onClick={DecNum}> - </Button> <span className="countOutput">{count}</span> <Button className="plusIc" onClick={IncNum}> + </Button> </td>
              </tr>
              <tr>
              <td>Longtail</td>
              <td>Short one line Description</td>
              <td><Button className="minusIc" onClick={DecNum}> - </Button> <span className="countOutput">{count}</span> <Button className="plusIc" onClick={IncNum}> + </Button> </td>
              </tr>
          </tbody>
          </table>
          <div className="submit-continue-button">
              <Button className="custom-btn"> Submit & Continue </Button>
          </div>
      </div>
     </div>

    </main>
  )
}
