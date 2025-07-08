

import React from "react";
import './order.css';
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import CheckIcon from '@mui/icons-material/Check';

export default function View() {

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
          <p> <strong> View Order </strong> </p>
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
              <th>S.NO.</th>
              <th>Order #</th>
              <th> Details </th>
              <th> Status </th>
              <th> Complete </th>
              </tr>
          </thead>
          <tbody>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
              </tr>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="light_blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
              </tr>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
              </tr>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="light_blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
              </tr>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
              </tr>
              <tr>
              <td>1</td>
              <td>22-8-22 MICHAEL </td>
              <td> <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
              <td> Incomplete </td>
              <td> <Button className="light_blu_bg custom-btn_NM"> <CheckIcon /> Mark as Complete </Button> </td>
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
