import React from "react";
import './admin.css'
import { useState, useContext, useEffect } from "react";
import LogoImage from "./../../../../images/logo-retail.png"
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import { PicBaseUrl } from "../../../../imageBaseURL";

export default function ManageRetailer(){

   const { user } = useContext(Context)
   const [retailers, setRetailers] = useState([])
   const [showRetailers, setShowRetailers] = useState(false)

    useEffect(() => {
        const fetchRetailer = async () => {
            const res = await axiosInstance.post("retailer/fetchAll", {token:user.data.token})
            if(res.data.status === true){
                setShowRetailers(true)
                setRetailers(res.data.data)
            }
        }
        fetchRetailer()
    },[])

    
    const handleStatusTrue = async (username) => {
        const Data = {
            user:{
                username:username,
                status:true
            },
            token:user.data.token
        }
        const res = await axiosInstance.put("retailer/update", Data)
        if(res){
            const res = await axiosInstance.post("retailer/fetchAll", {token:user.data.token})
            setRetailers(res.data.data)
        }
       
    }

    const handleStatusFalse = async (username) => {
        const Data = {
            user:{
                username:username,
                status:false
            },
            token:user.data.token
        }
        const res = await axiosInstance.put("retailer/update", Data)
        if(res){
            const res = await axiosInstance.post("retailer/fetchAll", {token:user.data.token})
            setRetailers(res.data.data)
        }
    } 
    
   
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Manage Retailers</strong>
                <Link to="/admin/addRetailer" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New Retailer </Link>
                </div>
                <table className="table">
                <thead>
                  <tr>
                    <th>RETAILER NAME</th>
                    <th>OWNER NAME</th>
                    <th>CODE</th>
                    <th>E-MAIL</th>
                    <th>PHONE</th>
                    <th>LOGO</th>
                    <th>EDIT</th>
                  </tr>
                </thead>
                <tbody>
                    { 
                    showRetailers
                    ?
                    retailers.map((retailer, key) => (
                    <tr key={key}>
                           <td><strong>{retailer.retailer_name.charAt(0).toUpperCase() + retailer.retailer_name.slice(1)}</strong></td>
                    <td>{retailer.owner_name.charAt(0).toUpperCase() + retailer.owner_name.slice(1)}</td>
                    <td>{retailer.retailer_code}</td>
                    <td>{retailer.email}</td>
                    <td><strong>{retailer.phone}</strong></td>
                    <td>{retailer.retailer_logo==null ? "No Image" : <img src={PicBaseUrl + retailer.retailer_logo} className="logo-retail"/>}</td>
                    <td><strong><Link to={`/admin/addRetailer/${retailer._id}`} className="action">Edit</Link></strong>  {retailer.status==true ? <button type="button" className="enablebutton" onClick={() => handleStatusFalse(retailer.username)}>Enable</button> : <button type="button" className="disablebutton" onClick={() => handleStatusTrue(retailer.username)}>Disable</button>}</td>
                    </tr>
                    ))
                :
                <></>}
                </tbody>
                </table>
            </div>
            </div>
        </main>
    )
}