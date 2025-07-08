import React from "react";
import './admin.css'
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ManageRetailerPrice(){

   const [ data , setData] = useState()

   
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Manage Retailer Pricing</strong>
                <button type="button" className="custom-btn"> <i className="fa-solid fa-plus"></i> Edit Retailer Pricing</button>
                </div>
                <div className="searchstyle searchstyle-one">
                    <div className="searchinput-inner">
                        <p>Fabric Type</p>
                        <select name="fabric" id="fabric" className='searchinput'>
                            <option value="all">All</option>
                            <option value="x">x</option>
                            <option value="y">y</option>
                            <option value="z">z</option>
                        </select>
                    </div>

                    <div className="searchinput-inner">
                        <p>category name</p>
                        <select name="category" id="category" className='searchinput'>
                            <option value="all">All Categories</option>
                            <option value="x">x</option>
                            <option value="y">y</option>
                            <option value="z">z</option>
                        </select>
                    </div>

                    <div className="searchinput-inner">
                        <p>retailer</p>
                        <select name="retail" id="retail" className='searchinput'>
                            <option value="all">Select Retailer</option>
                            <option value="x">x</option>
                            <option value="y">y</option>
                            <option value="z">z</option>
                        </select>
                    </div>

                    <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
                </div>
                <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>CATEGORY NAME</th>
                    <th>RETAILER CODE</th>
                    <th>FEBRIC TYPE</th>
                    <th>COST</th>
                    <th>OPTION</th>
                  </tr>
                </thead>
                <tbody>
                    <tr>
                    <td>01</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>02</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>03</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>04</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>05</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>06</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>07</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                    <tr>
                    <td>08</td>
                    <td>Category-3</td>
                    <td>MTANI</td>
                    <td>Jacket</td>
                    <td>34.00</td>
                    <td><strong><Link to="#" className="action">Edit</Link> | <Link to="#" className="action">Delete</Link></strong></td>
                    </tr>
                </tbody>
                </table>
            </div>
            </div>
        </main>
    )
}