import React from "react";
import {useState, useContext, useEffect } from 'react';
import "./RetailerHeader.css"
import Logo from "./../../../images/retailerLogo.jpg";
import { axiosInstance } from './../../../config'
// import User from "./../../images/usr.webp"
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link } from "react-router-dom";

import { PicBaseUrl } from "./../../../imageBaseURL";
import { Context } from "../../../context/Context";
import { useNavigate } from "react-router-dom";

export default function RetailerHeader(){
  const { dispatch } = useContext(Context)
    const [anchorEl, setAnchorEl] = React.useState(null)     
    const navigate = useNavigate();
    const [retailer, setRetailer] = useState({})
    const { user } = useContext(Context)
    const getData = {
      id:user.data.id,
      token:user.data.token
    }
    const [abstractSearchList, setAbstractSearchList] = useState([])
    const [existingCustomer, setExistingCustomer] = useState(false)
    const [showCustomerList, setShowCustomerList] = useState("none")
    const [allCustomers, setAllCustomers] = useState([])
    const [justAnArrayOfID, setJustAnArrayOfID] = useState([])
    const [abstractSearchListOrders, setAbstractSearchListOrders]   = useState([])

    useEffect(() => {
      const fetchRetailer = async () => {
         const res = await axiosInstance.post("retailer/fetch", getData)
         setRetailer(res.data.data[0])
      }
      fetchRetailer()
  },[])

    const handleSearchAbstract = async(e) => {
      
      if(e.target.value.length > 2){
        setAbstractSearchList(() => {
          return []
        })

          const res = await axiosInstance.post("/userMeasurement/fetchCustomerByLike/" + e.target.value , { token:user.data.token })
          console.log("result : ", res.data.data)
          if(res.data.status == true && res.data.data.length > 0){
            const jar = []
            for(let x of res.data.data){
              const obj = {}
              obj['name'] = x['firstname'] + " " + x['lastname'];
              obj['id'] = x['_id'];
              obj['type'] = 'customers'
              jar.push(obj)
            }
            
            // abstractSearchList.push(obj)
            setAbstractSearchList(jar)

            setShowCustomerList("block")
          }
          if(res.data.status ==false){
            setAbstractSearchList([])
          }

          const resOrders = await axiosInstance.post("/customerOrders/fetchOrderByLikeRetailer/" + user.data.id + "/" + e.target.value, {token: user.data.token})
          console.log(resOrders.data)
          if(resOrders.data.status == true && resOrders.data.data.length > 0){
            const jar = []
            for(let x of resOrders.data.data){
              const obj = {}
              obj['name'] = x.orderId;
              obj['id'] = x['_id'];
              obj['type'] = 'orders'
              jar.push(obj)
            }
            
            // abstractSearchList.push(obj)
            setAbstractSearchListOrders(jar)

            setShowCustomerList("block")
          }
          if(resOrders.data.status ==false){
            setAbstractSearchListOrders([])
          }
      } 
      if(e.target.value.length <= 2){
        setShowCustomerList("none")
        setAllCustomers([])
        setAbstractSearchList([])
      }
    }

    const handleAbstract = (e) => {
      if(e.target.dataset.type == 'customers'){
        navigate("/retailer/customerOrders/" + e.target.dataset.val)
        setShowCustomerList("none")
        setAllCustomers([])
        setAbstractSearchList([])
      }
      if(e.target.dataset.type == 'orders'){
        navigate("/retailer/searchOrder/" + e.target.dataset.val)
      }
    }

    
    const handleAnyThing = (e) => {
    }
    

    const open = Boolean(anchorEl)
    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    }
    const handleClose = () => {
      setAnchorEl(null);
    }

    const handleLogout = () => {
      dispatch({ type: "LOGOUT" });
      
    }
    const menuId = 'primary-search-account-menu';
    return (
        <header>
            <div className="header-nav">
                <div className="logo-box" >
                  <Link to="/"><img src={retailer['retailer_logo'] !== undefined  ? PicBaseUrl + retailer['retailer_logo'] : Logo} alt="SiamSuits Logo" /></Link>
                  <span><b>{user.data.retailer_name.toUpperCase()}</b></span>
                </div>   
                <div className="navigation-navm">
                    <div className="top-search-box">
                        <form className="expanding-search-form">
                            <div className="input-group">
                              <div className="searchicon"> <i className="fa-solid fa-magnifying-glass"></i> </div>
                                <input type="text" name="search" className="form-control" placeholder="Seach Order, Customer name" onChange={handleSearchAbstract}/>
                                <div style={{display:showCustomerList}} className="abstract-list" onMousedown={handleAnyThing}>
                                  <ul>
                                      {
                                      abstractSearchList.map((singleItem) => {
                                          return(
                                            <li style={{textTransform:'capitalize'}} key={singleItem['id']} data-val={singleItem['id']} data-type ={singleItem['type']} onClick={handleAbstract}><span>{singleItem['name']}</span> in <span>{singleItem['type']}</span></li>

                                          )                                        
                                      })
                                      }
                                      {
                                        abstractSearchListOrders.length > 0 ?
                                        abstractSearchListOrders.map((singleOrder) => {
                                          return(
                                            <li style={{textTransform:'capitalize'}} key={singleOrder['id']} data-val={singleOrder['id']} data-type ={singleOrder['type']} onClick={handleAbstract}><span>{singleOrder['name']}</span> in <span>{singleOrder['type']}</span></li>
                                          )
                                        })
                                        :
                                        <></>
                                      }
                                  </ul>
                                </div>
                                {/* <div className="search-dropdown">
                                
                                <Button
                                  id="basic-button"
                                  aria-controls={open ? 'basic-menu' : undefined}
                                  aria-haspopup="true"
                                  className="button dropdown-toggle"
                                  aria-expanded={open ? 'true' : undefined}
                                  onClick={handleClick}
                                >
                                  <span className="toggle-active"> Order </span>
                                  <span className="fa fa-angle-down pull-right"></span>
                                </Button>
                                <Menu
                                  id="basic-menu"
                                  anchorEl={anchorEl}
                                  open={open}
                                  onClose={handleClose}
                                  MenuListProps={{
                                    'aria-labelledby': 'basic-button',
                                  }}
                                >
                                  <MenuItem onClick={handleClose}>People</MenuItem>
                                  <MenuItem onClick={handleClose}>Products</MenuItem>
                                  <MenuItem onClick={handleClose}>Blog</MenuItem>
                                </Menu>
                                </div>  */}
                            </div>
                        </form>
                    </div>		     
                </div>
                <div className="nav-right-content">
                  <Button variant="contained" className="logout" onClick={handleLogout} ><LogoutIcon/> <span>Logout</span> </Button>
                </div>
            </div>
       </header>
    )
}