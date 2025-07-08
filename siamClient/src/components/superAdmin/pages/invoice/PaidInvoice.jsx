import React from "react";
import './invoice.css'
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';

export default function PaidInvoice(){

   const [ data , setData] = useState()

   const handleChange = () =>{

   }
   
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong> Invoice History </strong>
                </div>
                <div className="searchstyle searchstyle-one">
                  <div className="searchinput-inner">
                    <p>Start Date</p>
                    <input type="date" className="searchinput"/>
                  </div>
                  <div className="searchinput-inner">
                    <p>End Date</p>
                    <input type="date" className="searchinput"/>
                   </div>
						     <div className="searchinput-inner">
                    <p>Worker Name</p>
                    <select name="workername" id="workername" className="searchinput">
                        <option value="all">Select Worker Name</option>
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                    </select>
						             <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
                  </div>
                </div>
            </div>

            <div className="order-table">
              <table className="table">
              <thead>
                  <tr>
                  <th>Order #</th>
                  <th>Order Date</th>
                  <th> Name </th>
                  <th> Total Amount </th>
                  <th> Invoice </th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                  <td>BTP-00358</td>
                  <td> 02-12-22 </td>
                  <td> Nathalie </td>
                  <td> 75650 </td>
                  <td>  <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
                  </tr>
                  <tr>
                  <td>BTP-00358</td>
                  <td> 02-12-22 </td>
                  <td> Nathalie </td>
                  <td> 75650 </td>
                  <td>  <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
                  </tr>
                  <tr>
                  <td>BTP-00358</td>
                  <td> 02-12-22 </td>
                  <td> Nathalie </td>
                  <td> 75650 </td>
                  <td>  <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
                  </tr>
                  <tr>
                  <td>BTP-00358</td>
                  <td> 02-12-22 </td>
                  <td> Nathalie </td>
                  <td> 75650 </td>
                  <td>  <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
                  </tr>
                  <tr>
                  <td>BTP-00358</td>
                  <td> 02-12-22 </td>
                  <td> Nathalie </td>
                  <td> 75650 </td>
                  <td>  <Button className="Eyebtn"> <RemoveRedEyeIcon /> </Button> </td>
                  </tr>
              </tbody>
              </table>
              
            </div>
          </div>
        </main>
    )
}