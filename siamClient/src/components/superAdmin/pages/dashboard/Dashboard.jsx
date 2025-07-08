import React from "react";
import { Link } from "react-router-dom";


export default function Dashboard(){

    return(
      <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table">
                <div className="order-top-tabs filterbutton">
                <p> <strong> Order List </strong> </p>
                <ul>
                    <li> <button className="active"> New Orders <span>(19)</span> </button> </li>
                    <li> <button id="rushorder"> Rush Orders <span>(23)</span> </button> </li>
                    <li> <button> Modified <span>(23)</span> </button> </li>
                    <li> <button> Processing <span>(23)</span> </button> </li>
                    <li> <button> Ready for Shipment <span>(23)</span> </button> </li>
                    <li> <button> Sent <span>(23)</span> </button> </li>
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
                    <th>Note</th>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
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
                    <td>NA</td>
                    <td><a href="#" className="orderlist-new"> New Order  <i className="fa fa-angle-down"></i></a> </td>
                    </tr>
                </tbody>
                </table>
            </div>
            </div>
        </main>
    )
}