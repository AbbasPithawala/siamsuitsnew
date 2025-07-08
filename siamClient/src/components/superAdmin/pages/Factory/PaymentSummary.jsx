import React from "react";
import './factory.css'
import { useState } from "react";

export default function PaymentSummary(){

   const [ data , setData] = useState()

   const handleChange = () =>{

   }
   
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Payment Detail</strong>
                </div>
                <div className="searchstyle searchstyle-one">
                  <div className="searchinput-inner">
                    <p>Worker Name</p>
                    <select name="workername" id="workername" className="searchinput">
                        <option value="all">Select Worker Name</option>
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                    </select>
                  </div>
                  <div className="searchinput-inner">
                    <p>Start Date</p>
                    <input type="date" className="searchinput"/>
                  </div>
                  <div className="searchinput-inner">
                    <p>End Date</p>
                    <input type="date" className="searchinput"/>
                    <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
                  </div>
                </div>
            </div>
            </div>
        </main>
    )
}