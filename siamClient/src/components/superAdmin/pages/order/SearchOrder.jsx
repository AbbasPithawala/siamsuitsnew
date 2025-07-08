import React from "react";
import './order.css';
import { useState } from "react";
import { Link } from "react-router-dom";

export default function SearchOrder() {

  const [ data , setData] = useState()

  const handleChange = () =>{

  }

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

        <div className="order-table">
              <div className="order-top-tabs filterbutton">
                <p> <strong> Order List </strong> </p>
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
                    <th>ID</th>
                    <th>Retailer</th>
                    <th>Order #</th>
                    <th>CUST NAME</th>
                    <th>Order Date</th>
                    <th>QTY</th>
                    <th>VIEW/Edit</th>
                    <th>Pattern PDF</th>
                    <th>Update Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td>01</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>02</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>03</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>04</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>05</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>06</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>07</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                    <tr>
                    <td>08</td>
                    <td>Blue Textiles</td>
                    <td>GHA-123456</td>
                    <td>Brandon Show</td>
                    <td>11 Aug 2022</td>
                    <td>2</td>
                    <td><strong><Link to="#" className="action">View</Link></strong> | <Link to="#" className="action">Edit</Link></td>
                    <td><strong><Link to="#" className="action">Upload</Link></strong> | <a href="#">NA</a></td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                </tbody>
                </table>
            </div>

      </div>
    </main>
  )
}
