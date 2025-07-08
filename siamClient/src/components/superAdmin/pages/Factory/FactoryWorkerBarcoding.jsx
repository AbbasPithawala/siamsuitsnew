import React from "react";
import './factory.css'
import { useState } from "react";
import Divider from '@mui/material/Divider';

export default function FactoryWorkerBarcoding(){

   const [ data , setData] = useState()

   const handleChange = () =>{

   }
   
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Factory Worker Barcoding</strong>
                </div>
                <div className="searchstyle searchstyle-one">
                  <div className="searchinput-inner">
                    <p>Worker List</p>
                    <select name="workerlist" id="workerlist" className="searchinput">
                        <option value="all">Select Worker</option>
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                    </select>
                  </div>
                </div>
                <Divider>OR</Divider>
                <div className="searchstyle searchstyle-one">
                  <div className="searchinput-inner">
                    <p>Product</p>
                    <select name="product" id="product" className="searchinput">
                        <option value="all">Select Product</option>
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                    </select>
                    <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
                  </div>
                </div>
            </div>
            </div>
        </main>
    )
}