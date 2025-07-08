import React from "react";
import { useContext } from 'react';
import "./header.css"
import Logo from "./../../../images/logo.png"
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link } from "react-router-dom";
import { axiosInstance } from './../../../config'

import { Context } from "../../../context/Context";
import { useNavigate } from "react-router-dom";

export default function Header(){
  const { dispatch } = useContext(Context)
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [anchorEl2, setAnchorEl2] = React.useState(null);
    

    const open = Boolean(anchorEl);
    const open2 = Boolean(anchorEl2);
    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    const handleProfileMenuOpen = (event) => {
      setAnchorEl2(event.currentTarget);
    };
    const handleClose = () => {
      setAnchorEl(null);
    };
    const handleMenuClose = () => {
      setAnchorEl2(null);
    };

    const handleLogout = () => {
      dispatch({ type: "LOGOUT" });
    }
    const menuId = 'primary-search-account-menu';
    return (
        <header>
            <div className="header-nav">
                <div className="logo-box">
                    <Link to="/"><img src={Logo} alt="SiamSuits Logo" /></Link>
                    <div className="navigation-toggle">
                       <a href="#" id="togglemenu"> <i className="fa-solid fa-bars"></i> </a>
                    </div> 
                </div>   
                {/* <div className="navigation-navm">
                    <div className="top-search-box">
                        <form className="expanding-search-form">
                            <div className="input-group">
                              <div className="searchicon"> <i className="fa-solid fa-magnifying-glass"></i> </div>
                                <input type="text" name="search" className="form-control" placeholder="Seach Order #, Customer name, Invoice#, Shipment #" />
                                <div className="search-dropdown">
                                
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
                                </div> 
                            </div>
                        </form>
                    </div>		     
                </div> */}
                <div className="nav-right-content">
                  <Button variant="contained" className="logout" onClick={handleLogout} ><LogoutIcon/> <span>Logout</span> </Button>
                </div>
            </div>
       </header>
    )
}