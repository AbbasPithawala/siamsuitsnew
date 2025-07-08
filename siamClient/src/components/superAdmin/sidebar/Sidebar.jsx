
import React, { useState, useContext, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import MuiAccordion from '@mui/material/Accordion';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import { Link } from 'react-router-dom';
import "./sidebar.css"
import { Context } from '../../../context/Context';
import { axiosInstance } from '../../../config';

const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:not(:last-child)': {
    borderBottom: 0,
  },
  '&:before': {
    display: 'none',
  },
}));

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.8rem', color: '#242424' }} />}
    {...props}
  />
))(({ theme }) => ({
  // backgroundColor:
  //   theme.palette.mode === 'dark'
  //     ? 'rgba(255, 255, 255, .05)'
  //     : 'rgba(0, 34, 85, 1)',
  // flexDirection: 'row-reverse',
  // '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
  //   transform: 'rotate(90deg)',
  // },
  // '& .MuiAccordionSummary-content': {
  //   marginLeft: theme.spacing(1),
  // },
  // color:'white',
  // borderRadius: '5px',
  // fontSize:'0.9rem'
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(0.5),
  borderTop: '1px solid rgba(0, 0, 0, .125)',
}));

export default function Sidebar() {
  const [expanded, setExpanded] = React.useState('');
  const [selectedSidebarLink, setSelectedSidebarLink] = React.useState("")
  const [roleModule, setRoleModule] = useState([])

  const { user } = useContext(Context)
  const roleData = {
    name: user.data.role,
    token: user.data.token
  }

  useEffect(() => {
    const fetchRoles = async () => {
      const res = await axiosInstance.post("roles/fetchFromRoleName", roleData)
      setRoleModule(res.data.data[0].modules)
    }
    fetchRoles()
  }, [])


  const handleChange = (panel) => (event, newExpanded) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <aside className="sidebar">
      <div id="leftside-navigation" className="nano">
        <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel1d-content" id="panel1d-header" className="sidebarmenu">
            <i className="fa-solid fa-user"></i>
            <span>Admin</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {roleModule.includes("Manage Roles") ? <li><Link to="/admin/roles" className={selectedSidebarLink === "roles" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("roles") }}> Manage Roles </Link> </li> : <></>}
              {roleModule.includes("Manage User Login") ? <li><Link to="/admin/userlogin" className={selectedSidebarLink === "userlogin" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("userlogin") }}> Manage User Login </Link> </li> : <></>}
              {roleModule.includes("Manage Retailers") ? <li><Link to="/admin/retailer" className={selectedSidebarLink === "retailer" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("retailer") }}> Manage Retailers </Link> </li> : <></>}
              {roleModule.includes("Manage Products") ? <li><Link to="/admin/product" className={selectedSidebarLink === "product" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("product") }}> Manage Products </Link> </li> : <></>}
              {roleModule.includes("Manage Measurements") ? <li><Link to="/admin/measurements" className={selectedSidebarLink === "measurements" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("measurements") }}> Manage Measurements </Link> </li> : <></>}
              {roleModule.includes("Manage Styling Options") ? <li><Link to="/admin/styleoption" className={selectedSidebarLink === "styleoption" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("styleoption") }}> Manage Styling Options </Link> </li> : <></>}
              {/* {roleModule.includes("Manage Group Styling") ? <li><Link to="/admin/GroupStyle" className={selectedSidebarLink === "GroupStyle" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("GroupStyle") }}> Manage Group Styling </Link> </li> : <></>} */}
              {roleModule.includes("Manage Retailer Styling") ? <li><Link to="/admin/retailstyle" className={selectedSidebarLink === "retailstyle" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("retailstyle") }}> Manage Retailer Styling </Link> </li> : <></>}
              {roleModule.includes("Manage Measurement Fits") ? <li><Link to="/admin/measurementfits" className={selectedSidebarLink === "measurementfits" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("measurementfits") }}> Manage Measurement Fits </Link> </li> : <></>}
              {roleModule.includes("Manage Pipings") ? <li><Link to="/admin/pipings" className={selectedSidebarLink === "pipings" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("pipings") }}> Manage Pipings </Link> </li> : <></>}
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" className="sidebarmenu">
            <i className="fa-sharp fa-solid fa-industry"></i>
            <span>Factory</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {roleModule.includes("Manage Tailers") ? <li><Link to="/factory/tailers" className={selectedSidebarLink === "tailers" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("tailers") }}> Manage Tailors </Link> </li> : <></>}
              {roleModule.includes("Manage Jobs") ? <li><Link to="/factory/AssignItem" className={selectedSidebarLink === "AssignItem" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("AssignItem") }}> Assign Item </Link> </li> : <></>}
              {roleModule.includes("Manage Jobs") ? <li><Link to="/factory/jobs" className={selectedSidebarLink === "jobs" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("jobs") }}> Payment Summary </Link> </li> : <></>}
              {/* {roleModule.includes("Manage Positions") ? <li><Link to="/factory/positions" className={selectedSidebarLink === "positions" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("positions") }}> Manage Positions </Link> </li> : <></>} */}
              {roleModule.includes("Manage Extra Payments") ? <li><Link to="/factory/extrapayments" className={selectedSidebarLink === "extrapayments" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("extrapayments") }}> Extra Payments Approval </Link> </li> : <></>}
              {roleModule.includes("Manage Extra Payment Categories") ? <li><Link to="/factory/paymentcategories" className={selectedSidebarLink === "paymentcategories" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("paymentcategories") }}> Manage Extra Payment Categories </Link> </li> : <></>}
              {/* <li><Link to="/factory/workerbarcoding" className={selectedSidebarLink === "workerbarcoding"? "activeList" : "notActive"} onClick={()=>{setSelectedSidebarLink("workerbarcoding")}}> Factory Worker Barcoding </Link> </li> */}
              {/* {roleModule.includes("Payment Summary") ? <li><Link to="/factory/paymentsummary" className={selectedSidebarLink === "paymentsummary" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("paymentsummary") }}> Payment Summary </Link> </li> : <></>} */}
              {roleModule.includes("Work Payment History") ? <li><Link to="/factory/paymenthistory" className={selectedSidebarLink === "paymenthistory" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("paymenthistory") }}> Work Payment History </Link> </li> : <></>}
              {roleModule.includes("Add Worker Advance Payment") ? <li><Link to="/factory/advancepayment" className={selectedSidebarLink === "advancepayment" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("advancepayment") }}> Add Worker Advance Payment </Link> </li> : <></>}
              {/* <li><Link to="/factory/advancepaymenthistory" className={selectedSidebarLink === "advancepaymenthistory"? "activeList" : "notActive"} onClick={()=>{setSelectedSidebarLink("advancepaymenthistory")}}> Worker Advance Payment History </Link> </li> */}
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel3d-content" id="panel3d-header" className="sidebarmenu">
            <i className="fa-solid fa-box"></i>
            <span>Orders</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {/* {roleModule.includes("Search Orders") ? <li><Link to="/order/searchOrder" className={selectedSidebarLink === "searchOrder"? "activeList" : "notActive"} onClick={()=>{setSelectedSidebarLink("searchOrder")}}> Search Orders </Link> </li> : <></>} */}
              {roleModule.includes("New Order") ? <li><Link to="/order/newOrder" className={selectedSidebarLink === "newOrder" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("newOrder") }}> View Orders </Link> </li> : <></>}
              {/* {roleModule.includes("Modified") ? <li><Link to="/order/modified" className={selectedSidebarLink === "modified" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("modified") }}> Modified </Link> </li> : <></>}
              {roleModule.includes("Processing") ? <li><Link to="/order/processing" className={selectedSidebarLink === "processing" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("processing") }}> Processing </Link> </li> : <></>}
              {roleModule.includes("Ready for Shipping") ? <li><Link to="/order/readyforShipping" className={selectedSidebarLink === "readyforShipping" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("readyforShipping") }}> Ready for Shipping </Link> </li> : <></>}
              {roleModule.includes("Sent") ? <li><Link to="/order/sent" className={selectedSidebarLink === "sent" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("sent") }}> Sent </Link> </li> : <></>} */}
              {roleModule.includes("Manual Order") ? <li><Link to="/order/manualOrder" className={selectedSidebarLink === "manualOrder" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("manualOrder") }}> Manual Order </Link> </li> : <></>}
              {roleModule.includes("Add") ? <li><Link to="/order/add" className={selectedSidebarLink === "add" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("add") }}> Add </Link> </li> : <></>}
              {roleModule.includes("View") ? <li><Link to="/order/view" className={selectedSidebarLink === "view" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("view") }}> View </Link> </li> : <></>}
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={expanded === 'panel4'} onChange={handleChange('panel4')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel4d-content" id="panel4d-header" className="sidebarmenu">
          <i className="fas fa-layer-group"></i>
            <span> Group Orders</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li><Link to="/groupOrder/GroupOrder" className={selectedSidebarLink === "groupNewOrder" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("groupNewOrder") }}>View Group Orders</Link> </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={expanded === 'panel5'} onChange={handleChange('panel5')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel5d-content" id="panel5d-header" className="sidebarmenu">
            <i className="fa-solid fa-file-invoice"></i>
            <span>Invoice</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {roleModule.includes("Create Invoice") ? <li><Link to="/invoice/createinvoice" className={selectedSidebarLink === "createinvoice" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("createinvoice") }}> Create Invoice </Link> </li> : <></>}
              {roleModule.includes("Invoice History") ? <li><Link to="/invoice/invoicehistory" className={selectedSidebarLink === "invoicehistory" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("invoicehistory") }}> Invoice History </Link> </li> : <></>}
              {/* {roleModule.includes("Paid Invoice") ? <li><Link to="/invoice/paidinvoice" className={selectedSidebarLink === "paidinvoice" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("paidinvoice") }}> Paid Invoice </Link> </li> : <></>} */}
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={expanded === 'panel6'} onChange={handleChange('panel6')} className="Accrodian-main">
          <AccordionSummary aria-controls="panel6d-content" id="panel6d-header" className="sidebarmenu">
            <i className="fa-solid fa-truck-fast"></i>
            <span>Shipping</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {roleModule.includes("Shipping Box Report") ? <li><Link to="/shipping/shippingboxreport" className={selectedSidebarLink === "shippingboxreport" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("shippingboxreport") }}> Packaging List </Link> </li> : <></>}
              {roleModule.includes("Order Status Barcoding") ? <li><Link to="/shipping/orderstatusbarcoding" className={selectedSidebarLink === "orderstatusbarcoding" ? "activeList" : "notActive"} onClick={() => { setSelectedSidebarLink("orderstatusbarcoding") }}> Order Status Barcoding </Link> </li> : <></>}
            </ul>
          </AccordionDetails>
        </Accordion>
      </div>
    </aside>
  );
}