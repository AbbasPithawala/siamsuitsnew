import * as React from "react";
import { styled } from "@mui/material/styles";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion from "@mui/material/Accordion";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import { Link } from "react-router-dom";
import "./RetailerSidebar.css";

const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={
      <ArrowForwardIosSharpIcon sx={{ fontSize: "0.8rem", color: "#242424" }} />
    }
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
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

export default function RetailerSidebar() {
  const [expanded, setExpanded] = React.useState("");
  const [selectedSidebarLink, setSelectedSidebarLink] = React.useState("");

  const handleChange = (panel) => (event, newExpanded) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <aside className="sidebar">
      <div id="leftside-navigation" className="nano">
        <Accordion
          expanded={expanded === "panel1"}
          onChange={handleChange("panel1")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel1d-content"
            id="panel1d-header"
            className="sidebarmenu"
          >
            <i className="fa-solid fa-user"></i>
            <span>Customer</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {/* <li><Link to="/retailer/searchCustomerOrder" className={selectedSidebarLink === "roles"? "activeList" : "notActive"} onClick={()=>{setSelectedSidebarLink("searchCustomerOrder")}}> Search Customer Order </Link> </li>*/}
              <li>
                <Link
                  to="/retailer/viewCustomers"
                  className={
                    selectedSidebarLink === "viewCustomers"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("viewCustomers");
                  }}
                >
                  {" "}
                  View Customers{" "}
                </Link>{" "}
              </li>
              <li>
                <Link
                  to="/retailer/newCustomer"
                  className={
                    selectedSidebarLink === "newCustomer"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("newCustomer");
                  }}
                >
                  {" "}
                  New Customer{" "}
                </Link>{" "}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === "panel2"}
          onChange={handleChange("panel2")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel2d-content"
            id="panel2d-header"
            className="sidebarmenu"
          >
         <i className="fas fa-layer-group"></i>
            <span>Orders</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li>
                <Link
                  to="/"
                  className={
                    selectedSidebarLink === ""
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("");
                  }}
                >
                  {" "}
                  Orders{" "}
                </Link>{" "}
              </li>
              <li>
                <Link
                  to="/retailer/newCustomer"
                  className={
                    selectedSidebarLink === "newCustomer"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("newCustomer");
                  }}
                >
                  {" "}
                  Create New Order{" "}
                </Link>{" "}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === "panel3"}
          onChange={handleChange("panel3")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel3d-content"
            id="panel3d-header"
            className="sidebarmenu"
          >
          <i className="fa-sharp fa-solid fa-people-group"></i>
            <span> Group Order</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {/* <li>
                <Link
                  to="/retailer/placeGroupOrder"
                  className={
                    selectedSidebarLink === "placeGroupOrder"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("placeGroupOrder");
                  }}
                >
                  {" "}
                  Place Group Order{" "}
                </Link>{" "}
              </li>
              <li>
                <Link
                  to="/retailer/createGroupOrder"
                  className={
                    selectedSidebarLink === "createGroupOrder"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("createGroupOrder");
                  }}
                >
                  {" "}
                  Create New{" "}
                </Link>{" "}
              </li>
              <li>
                <Link
                  to="/retailer/viewGroupOrder"
                  className={
                    selectedSidebarLink === "viewGroupOrder"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("viewGroupOrder");
                  }}
                >
                  {" "}
                  View{" "}
                </Link>{" "}
              </li> */}
               <li>
                <Link
                  to="/retailer/newGroupOrder"
                  className={
                    selectedSidebarLink === "newGroupOrder"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("newGroupOrder");
                  }}
                >
                  {" "}
                  New Group Order{" "}
                </Link>{" "}
              </li>
              <li>
                <Link
                  to="/retailer/viewGroupOrder"
                  className={
                    selectedSidebarLink === "viewGroupOrder"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("viewGroupOrder");
                  }}
                >
                  {" "}
                  View {" "}
                </Link>{" "}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === "panel4"}
          onChange={handleChange("panel4")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel4d-content"
            id="panel4d-header"
            className="sidebarmenu"
          >
            <i className="fa-solid fa-file-invoice"></i>
            <span>Invoice</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li>
                <Link
                  to="/retailer/invoicehistory"
                  className={
                    selectedSidebarLink === "invoicehistory"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("invoicehistory");
                  }}
                >
                  {" "}
                  History{" "}
                </Link>{" "}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === "panel5"}
          onChange={handleChange("panel5")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel5d-content"
            id="panel5d-header"
            className="sidebarmenu"
          >
            <i className="fa-solid fa-truck-fast"></i>
            <span>Shipment</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li>
                <Link
                  to="/retailer/retailershipment"
                  className={
                    selectedSidebarLink === "retailershipment"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("retailershipment");
                  }}
                >
                  {" "}
                  Shipment{" "}
                </Link>{" "}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === "panel6"}
          onChange={handleChange("panel6")}
          className="Accrodian-main"
        >
          <AccordionSummary
            aria-controls="panel5d-content"
            id="panel5d-header"
            className="sidebarmenu"
          >
            <i className="fa-solid fa-user"></i>
            <span>Profile</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li>
                <Link
                  to="/retailer/retailerProfile"
                  className={
                    selectedSidebarLink === "retailerProfile"
                      ? "activeList"
                      : "notActive"
                  }
                  onClick={() => {
                    setSelectedSidebarLink("retailerProfile");
                  }}
                >
                  
                  Profile Settings
                </Link>
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>
      </div>
    </aside>
  );
}
