import React from "react";
import "./groupOrder.css";
import "./pdfStyle.css";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import { PicBaseUrl, PicBaseUrl3, PicBaseUrl4 } from "../../../../imageBaseURL";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import ReactDOMServer from "react-dom/server";
import { renderToString } from "react-dom/server";
import jsPDF from "jspdf";
import { useRef } from "react";
import mainQR from "../../../../images/PDFQR.png";
import signature from "../../../../images/signature.png";
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from "react-router-dom";

import ManualMeasurementsSize from "./ManualMeasurementsSize";
import THBText from 'thai-baht-text'

// importing table components from MUI=====================

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function GroupOrder() {
  const { user } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState([]);
  const [l1, setLength1] = useState(Number);
  const [l2, setLength2] = useState(Number);
  const [l3, setLength3] = useState(Number);
  const [l4, setLength4] = useState(Number);
  const [l5, setLength5] = useState(Number);
  const [l6, setLength6] = useState(Number);
  const [l7, setLength7] = useState(Number);
  const [custName, setCustName] = useState("");
  const [retailer, setRetailer] = useState("");
  const [date, setDate] = useState("");
  const [retailers, setRetailers] = useState([]);
  const [checkboxItem, setCheckboxItem] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(10);
  const [index, setIndex] = useState(0);
  const [statusName, setStatusName] = useState("New Order");
  const [orderItemString, setOrderItemString] = useState("")
  const [styleFabricCode, setStyleFabricCode] = useState([])
  const pdfRef = useRef(null);
  let [name, setName] = useState("");
  let [name1, setName1] = useState("");
  let [d, setD] = useState("");  
  const [anchorEl, setAnchorEl] = useState(null);
  const [fabricDialogOpen, setFabricDialogOpen] = useState(false);
  const [openOrderCustomerTable, setOpenOrderCustomerTable] = useState(false)
  const [products, setProducts] = useState([]);
  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [showOrders, setShowOrders] = useState(false)
  const [showRetailers, setShowRetailers] = useState(false)
  const [generatePDFButton, setGeneratePDFButton] = useState(false)
  const navigate = useNavigate();


  useEffect(() => {
    // fetchData(page, limit, statusName, name, name1, d);
    const par = {
      order_status: statusName,
    }
    fetchPageOrders(par, (page - 1)*5)
  }, [page, statusName]);

  useEffect(() => {
    fetchRetailers();
    fetchAllOrders();
    fetchProducts();
  }, []);

  const count = Math.ceil(docLength / limit);

  const handleChangePage = (e, p) => {
    setIndex(limit * (p - 1));
    setPage(p);
    const par = {
      order_status: statusName
    }
    if(name1.length > 0){
      par['retailerName'] = name1
    }
    if(name.length > 0){
      par['name'] = name
    }
    if(d.length > 0){
      par['orderDate'] = d
    }

    fetchPageOrders(par, (p - 1) * 5)
  };

  console.log("orders: ", orders)

  const searchChange = async (event) => {
    const { value } = event.target;
    // setName1("");
    // setD("");
    name = value;
    setName(value);
    // fetchData(1, limit, statusName, value.trim(), name1, d);
  };

  const searchSelectChange = async (event) => {
 
    const { value } = event.target;
    // setName("");
    // setD("");
    setRetailer(value);
    name1 = value;
    setName1(value);
    // fetchData(1, limit, statusName, name, value.trim(), d);
  };

  const searchDateChange = async (event) => {
    const { value } = event.target;
    // setName("");
    // setName1("");
    let result;
    if (value === "") {
      result = value;
      d = result;
      setD(result);
    } else {
      const [year, month, day] = value.split("-");
      result = [day, month, year].join("-");
      d = result;
      setD(result);
    }

    // fetchData(1, limit, statusName, name, name1, result);
  };

  const handleSearch = () => {
    const par = {
      order_status: statusName
    }

    if(name1.length > 0){
      par['retailerName'] = name1
    }
    if(name.length > 0){
      par['name'] = name
    }
    if(d.length > 0){
      par['orderDate'] = d
    }

    fetchPageOrders(par, (page - 1) * 5)
    // const obj = {
    //   tailor: tailor['_id']
    // };
    // if(startDate.length > 0){
    //   obj['startDate'] = startDate
    // }
    // if(endDate.length > 0){
    //   obj['endDate'] = startDate
    // }
    // fetchJobs(obj);
    // setTailorAdvance(tailor['advancePayment'])
  }

  const handleChange = async (id, value) => {
    const statusChange = {
      order_status: value,
      token: user.data.token,
    };
    const res = await axiosInstance.put(
      `/groupOrders/updateStatus/${id}`,
      statusChange
    );
    if (res) {
      fetchData(page, limit, statusName, name, name1, d);
      fetchAllOrders();
    }
    setOpen(true);
    setSuccess(true);
  };

  const handleId = async (e) => {
    if (e.target.checked) {
      setCheckboxItem([...checkboxItem, e.target.value]);
    } else {
      const updatedSelectedItem = checkboxItem.filter(
        (selectedItem) => selectedItem !== e.target.value
      );
      setCheckboxItem(updatedSelectedItem);
    }
    fetchData(page, limit, statusName, name, name1, d);
  };

  const handleUpdateStatus = async (e, p) => {
    const statusChange = {
      order_status: e.target.value,
      token: user.data.token,
    };
    for (let id of checkboxItem) {
      const res1 = await axiosInstance.put(
        `/groupOrders/updateStatus/${id}`,
        statusChange
      );
      if (res1) {
        fetchData(page, limit, statusName, name, name1, d);
        fetchAllOrders();
      }
      setOpen(true);
      setSuccess(true);
    }
  };

  const handleCloseOrderCustomerTable = () => {
    setOpenOrderCustomerTable(false)
  }
  const handleViewthisOrderCustomer = async (order) => {
    fetchOrder(order);
    setOpenOrderCustomerTable(true)
  }

  // const handlePrintPDF = async(e) => {
  //   const newOrderObject = JSON.parse(JSON.stringify(order[0]))
  //   const thisCustomer = order[0]['customers'].filter((customer) => customer['_id'] == e.target.dataset.customerid)
  //   delete newOrderObject['customers']
  //   delete newOrderObject['customer_quantity']
  //   newOrderObject['customerName'] = thisCustomer[0]['firstname'] + " " + thisCustomer[0]['lastname']
  //   newOrderObject['customer_id'] = thisCustomer[0]['_id']
  //   if(thisCustomer[0]['manualSize']){
  //     newOrderObject['manualSize'] = thisCustomer[0]['manualSize'] 
  //   }
  //   if(thisCustomer[0]['measurementsObject']){
  //     newOrderObject['measurements'] = thisCustomer[0]['measurementsObject']
  //   }
    
  //   for(let x of order[0]['order_items']){
  //     if(x['item_name'] == "suit"){
  //       const suitMeas = {
  //         jacket: thisCustomer[0]['measurementsObject']['jacket'],
  //         pant: thisCustomer[0]['measurementsObject']['pant']
  //       }
  //       newOrderObject['Suitmeasurements'] = suitMeas
  //     }
  //   }
  //   // console
  //   let draftMeasurementsObj = {}
  //   // if(order[0].repeatOrder == true){
  //   //   const previousOrder = await axiosInstance.post("/customerOrders/fetchOrderByID/" + res.data.data[0]['repeatOrderID'], {token : user.data.token})
  //   //   draftMeasurementsObj = previousOrder.data.data[0]['measurements']
  //   // }else{
  //     // const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + thisCustomer[0]['_id'], {token: user.data.token})


  //     // draftMeasurementsObj = existingOrders.data.data[0]['measurements']



  //   exportPDF(newOrderObject, draftMeasurementsObj)
  // }

  const handlePrintPDF = async(e) => {
    setGeneratePDFButton(true)
    const newOrderObject = JSON.parse(JSON.stringify(order[0]))
    const thisCustomer = order[0]['customers'].filter((customer) => customer['_id'] == e.target.dataset.customerid)
    delete newOrderObject['customers']
    delete newOrderObject['customer_quantity']
    newOrderObject['customerName'] = thisCustomer[0]['firstname'] + " " + thisCustomer[0]['lastname']
    newOrderObject['customer_id'] = thisCustomer[0]
    if(thisCustomer[0]['manualSize']){
      newOrderObject['manualSize'] = thisCustomer[0]['manualSize'] 
    }
    if(thisCustomer[0]['measurementsObject']){
      newOrderObject['measurements'] = thisCustomer[0]['measurementsObject']
    }
    
    for(let x of order[0]['order_items']){
      if(x['item_name'] == "suit"){
        const suitMeas = {
          jacket: thisCustomer[0]['measurementsObject']['jacket'],
          pant: thisCustomer[0]['measurementsObject']['pant']
        }
        newOrderObject['Suitmeasurements'] = suitMeas
      }
    }
    // console
    let draftMeasurementsObj = {}
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + thisCustomer[0]['_id'], {token: user.data.token})

      // draftMeasurementsObj = existingOrders.data.data[0]['measurements']
      if(existingOrders.data.status == true){
        let ind = 0;
        let ourIndex ;
        for(let x of existingOrders.data.data){
          if(x['_id'] == order){
            ourIndex = ind
          }
          ind = ind + 1
        }

        if(existingOrders.data.data.length > 1)
        {
          draftMeasurementsObj = existingOrders.data.data[0]['measurements']
        }
      }
    // }
    exportPDF(newOrderObject, draftMeasurementsObj)
  }

  
  const exportPDF = async (thisOrder, draftMeasurementsObj) => {

    let orderItemsArrayPDF = [];

    let justAnArray = [];
    


    // const res = await axiosInstance.post(
    //   "/customerOrders/fetchOrderByID/" + order,
    //   { token: user.data.token }
    // );
    


    const res1 = await axiosInstance.post('/retailer/fetch', {
      token: user.data.token,
      id: thisOrder['retailer_id']
    })


    var retailerObject = res1.data.data[0]


    let orderItemsArray = [];
    for (let m of thisOrder["order_items"]) {
      if (m.item_name == "suit") {
        for (let l of Object.keys(thisOrder.Suitmeasurements)) {
          for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
            let itemsObject = {
              item_name: m["item_name"],
              item_code: l + " " + n,
              quantity: m["quantity"],
              styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
            };
            orderItemsArray.push(itemsObject);
          }
        }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          orderItemsArray.push(itemsObject);
        }
      }
      // for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
      //   let itemsObject = {
      //     item_name: m["item_name"],
      //     item_code: m["item_name"] + " " + n,
      //     quantity: m["quantity"],
      //     styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
      //   };
      //   orderItemsArray.push(itemsObject);
      // }
    }

    let j = 1;

    for (let m of thisOrder["order_items"]) {
      if (m.item_name == "suit") {
        for (let l of Object.keys(thisOrder.Suitmeasurements)) {
          for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
            let itemsObject = {
              item_name: m["item_name"],
              item_code: l + " " + n,
              quantity: m["quantity"],
              repeatOrder: thisOrder["repeatOrder"],
              styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
            };
            
            

            if (j % 5 == 0 || orderItemsArray.length == j) {
              justAnArray.push(itemsObject);
              orderItemsArrayPDF.push(justAnArray);
              justAnArray = [];
            } else {
              justAnArray.push(itemsObject);
            }

            j = j + 1;
          }
        }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            repeatOrder: thisOrder["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject);
          }

          j = j + 1;
        }
      }
      // for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
      //   let itemsObject = {
      //     item_name: m["item_name"],
      //     item_code: m["item_name"] + " " + n,
      //     quantity: m["quantity"],
      //     repeatOrder: res.data.data[0]["repeatOrder"],
      //     styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
      //   };

      //   if (j % 5 == 0 || orderItemsArray.length == j) {
      //     justAnArray.push(itemsObject);
      //     orderItemsArrayPDF.push(orderItemsArray);
      //     justAnArray = [];
      //   } else {
      //     justAnArray.push(itemsObject);
      //   }

      //   j = j + 1;
      // }
    }

    let singleOrderArray = [];

    for (let m of thisOrder["order_items"]) {
      if (m.item_name == "suit") {
        for (let l of Object.keys(thisOrder.Suitmeasurements)) {
          for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
            let itemsObject = {
              item_name: m["item_name"],
              item_code: l + " " + n,
              quantity: m["quantity"],
              styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
              measurementsObject: thisOrder.Suitmeasurements[l],
              manualSize:
              thisOrder.manualSize == null ? (
                  <></>
                ) : (
                  thisOrder.manualSize[m["item_name"]]
                ),
            };
            singleOrderArray.push(itemsObject);
          }
        }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
            measurementsObject: thisOrder.measurements[m["item_name"]],
            manualSize:
            thisOrder.manualSize == null ? (
                <></>
              ) : (
                thisOrder.manualSize[m["item_name"]]
              ),
          };
          singleOrderArray.push(itemsObject);
        }
      }
    }

    let doc = new jsPDF("l", "px", [595, 842]);
    
    // let htmlElement = (
    //   <>
    //     <div className="view-order-contents">
    //       {orderItemsArrayPDF.map((sub, index) => {
    //         // let marginBottomVar = 90- index * 20 + "px";

    //         if (index == orderItemsArrayPDF.length - 1) {
    //           var variableLength = 5 - sub.length;
    //         }
    //         var dummyElements = [];
    //         for (let i = 1; i <= variableLength; i++) {
    //           dummyElements.push(i);
    //         }
    //         return (
    //           <div
    //             key={index}
    //             className="view-order-top-contents"
    //             style={{ paddingTop: "0", height:"600px" }}
    //           >
    //             {/* <h3
    //               style={{
    //                 paddingBottom: "5px",
    //                 textAlign: "center",
    //                 fontSize: "10px",
    //                 textTransform: "uppercase",
    //                 width: "100%",
    //                 margin: 0
    //               }}
    //             >
    //               Siam Suits Supply {index + 1}
    //             </h3> */}

    //             {/* <div className="order-header" style={{ padding: "0" }} >
    //               <div className="person-details" style={{ padding: "0", display:"flex", flexDirection:"row"}}>
    //                 <div
    //                   className="details-group"
    //                   style={{ border: "0", paddingLeft: "0px" }}
    //                 >
    //                   <ul style={{ paddingLeft: "0px" }}>
    //                     <li style={{ border: "0" }}>
    //                       <span style={{ fontSize: "10px" }}>
    //                         Customer Name: {res.data.data[0].customerName}
    //                       </span>

    //                     </li>
    //                     <li style={{ border: "0" }}>
    //                       <span style={{ fontSize: "10px", lineHeight: "0" }}>
    //                         Order Date: {res.data.data[0].OrderDate}
    //                       </span>
    //                     </li>
    //                     <li
    //                       style={{
    //                         border: "0",
    //                         textAlign: "right",
    //                         justifyContent: "end",
    //                         marginTop: "-10px",
    //                       }}
    //                     >
    //                       <span
    //                         style={{
    //                           fontSize: "10px",
    //                           lineHeight: "0",
    //                           textAlign: "right",
    //                         }}
    //                       >
    //                         Male(malethai)
    //                       </span>
    //                     </li>
    //                   </ul>
    //                 </div>
    //                 <div className="person-identity" style={{ border: "0px" }}>
    //                   <h2 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                     <u>{res.data.data[0].orderId}</u>
    //                   </h2>
    //                 </div>
    //                 <div className="person-identity" style={{ border: "0px" }}>
    //                 <span style={{ fontSize: "10px" }}>
    //                         Customer Profile: <img width="25" height="25" src={PicBaseUrl + res.data.data[0]['customer_id']['image']} alt="" />
    //                       </span>

    //                 </div>
    //                 <div className="person-upi-code" style={{ border: "0px" }}>
    //                   <p style={{ fontSize: "10px", lineHeight: "0" }}>
    //                     Repeat Order:{" "}
    //                     <span style={{ textTransform: "capitalize" }}>
    //                       {res.data.data[0].repeatOrder == true ? "Yes" : "No"}
    //                     </span>
    //                   </p>
    //                   <img
    //                     src={PicBaseUrl + retailerObject['retailer_logo']}
    //                     className="img-fit"
    //                     style={{
    //                       width: "30%",
    //                       margin: "10px auto",
    //                       objectFit: "cover",
    //                     }}
    //                   />
    //                 </div>
    //               </div>
    //             </div> */}
    //             <div className="top-header"style={{border: '1px solid black', padding: '2px'}}>
                 
    //             <div className="top-list-data" style={{display:'flex', alignItems:'center', justifyContent:'space-between', columnGap: '20px', rowGap:'20px'}}>
    //               <div className="info">
    //                 <p style={{fontSize:'9px'}}>Customer Name : {thisOrder.customerName}</p>
    //                 <p style={{fontSize:'9px'}}>Order Date : {thisOrder.OrderDate}</p>
    //                 <p style={{fontSize:'9px'}}>Repeat Order : {thisOrder.repeatOrder == true ? "Yes" : "No"}</p>
    //                 {thisOrder['order_status'] == "Modified" ? <p style={{fontSize:'9px', color:"green"}}>Modified</p>: <></>}
    //               </div>

    //               <div className="order-id">
    //               <p style={{fontSize:'10px', transform:'translateX(-50px)'}}>{thisOrder.orderId}</p>
    //              </div> 
                 
    //               <div className="info" style={{display: 'flex', alignItems:'center', columnGap: '10px'}}>
    //                 <img src={PicBaseUrl + retailerObject['retailer_logo']} style={{width: '50px', height: '50px'}}/>
    //               </div>

    //              </div>
    //               </div>
    //             <div
    //               className="product-details"
    //               style={{
    //                 border: "0",
    //                 paddingTop: "0",
    //                 paddingRight: "0",
    //                 paddingLeft: "0",
    //               }}
    //             >
    //               <div className="details-table" style={{ border: "0" }}>
    //                 <div className="tableData">
    //                   <table
    //                     key={index}
    //                     style={{
    //                       borderCollapse: "collapse",
    //                       borderSpacing: "0",
    //                       pageBreakAfter: "always",
    //                       height: "100%",
    //                     }}
    //                   >
    //                     <tbody>
    //                       {sub.map((singles, i) => {
    //                         return (
    //                           <tr key={i}>
    //                             <td
    //                               style={{
    //                                 borderLeft: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 textAlign: "center",
    //                                 backgroundColor: "white",
    //                                 padding: "0",
    //                               }}
    //                             >
    //                               <span
    //                                 style={{
    //                                   fontSize: "10px",
    //                                   lineHeight: "0",
    //                                 }}
    //                               >
    //                                 {singles.item_name.charAt(0).toUpperCase() + singles.item_name.slice(1)}
    //                               </span>
    //                             </td>
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 textAlign: "center",
    //                                 backgroundColor: "white",
    //                                 padding: "0",
    //                               }}
    //                             >
    //                               <span
    //                                 style={{
    //                                   fontSize: "10px",
    //                                   lineHeight: "0",
    //                                 }}
    //                               >
    //                                 {singles.item_code.charAt(0).toUpperCase() + singles.item_code.slice(1)}
    //                               </span>
    //                             </td>
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 textAlign: "center",
    //                                 backgroundColor: "white",
    //                                 padding: "0",
    //                               }}
    //                             >
    //                               <span
    //                                 style={{
    //                                   fontSize: "10px",
    //                                   lineHeight: "0",
    //                                 }}
    //                               >{`(${singles.styles.fabric_code})`}</span>
    //                             </td>
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 textAlign: "center",
    //                                 backgroundColor: "white",
    //                                 padding: "5px",
    //                               }}
    //                             >
    //                               <img
    //                                 src={mainQR}
    //                                 className="img-fit"
    //                                 width="60"
    //                                 height="60"
    //                                 // style={{ width: "40%" }}
    //                               />
    //                             </td>
    //                           </tr>
    //                         );
    //                       })}

    //                       {dummyElements.length > 0 ? (
    //                         dummyElements.map((element, i) => {
    //                           return (
    //                             <tr key={i}>
    //                               <td
    //                                 style={{
    //                                   borderLeft: "1px solid #ffffff",
    //                                   borderRight: "1px solid #ffffff",
    //                                   borderBottom: "1px solid #ffffff",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   padding: "0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "10px",
    //                                     lineHeight: "0",
    //                                   }}
    //                                 ></span>
    //                               </td>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #ffffff",
    //                                   borderBottom: "1px solid #ffffff",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   padding: "0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "10px",
    //                                     lineHeight: "0",
    //                                   }}
    //                                 ></span>
    //                               </td>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #ffffff",
    //                                   borderBottom: "1px solid #ffffff",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   padding: "0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "10px",
    //                                     lineHeight: "0",
    //                                   }}
    //                                 ></span>
    //                               </td>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #ffffff",
    //                                   borderBottom: "1px solid #ffffff",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   padding: "5px",
    //                                 }}
    //                               >
    //                                 {" "}
    //                                 <span
    //                                   style={{
    //                                     display: "block",
    //                                     minHeight: "75px",
    //                                   }}
    //                                 ></span>
    //                               </td>
    //                             </tr>
    //                           );
    //                         })
    //                       ) : (
    //                         <></>
    //                       )}
    //                     </tbody>
    //                   </table>
    //                 </div>
    //               </div>
    //             </div>
    //           </div>
    //         );
    //       })}
    //       {singleOrderArray.map((orderItem, i) => {
            
    //         return (
    //           <>
    //             <div
    //               key={i}
    //               className="view-order-top-contents"
    //               style={{ height: "590px", overflow:"hidden", marginTop: "0px", marginBottom:"0px"}}
    //             >
    //               {/* <h3
    //                 style={{
    //                   paddingBottom: "5px",
    //                   textAlign: "center",
    //                   fontSize: "10px",
    //                   textTransform: "uppercase",
    //                   width: "100%",
    //                   margin: "10px 0 0 0",
    //                 }}
    //               >
    //                 Siam Suits Supply
    //               </h3> */}
    //               <div
    //                 className="order-header"
    //                 style={{ paddingLeft: "0px", paddingBottom: "0" }}
    //               >
    //                 <div className="person-details" style={{ padding: "0px" }}>
    //                   <div
    //                     className="details-group"
    //                     style={{ border: "0px", paddingLeft: "0px" }}
    //                   >
    //                     <ul style={{ paddingLeft: "0px" }}>
    //                       <li style={{ border: "0px", display: "flex" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Name:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             {thisOrder.customerName}
    //                           </span>{" "}
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Order Date:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             {thisOrder.orderDate}
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           QTY:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             1 OF 2
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Old Order:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             No Oreders
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li
    //                         style={{
    //                           border: "0",
    //                           textAlign: "right",
    //                           justifyContent: "end",
    //                           marginTop: "-10px",
    //                         }}
    //                       >
    //                         <span
    //                           style={{
    //                             fontSize: "10px",
    //                             lineHeight: "0",
    //                             textAlign: "right",
    //                           }}
    //                         >
    //                           Male(malethai)
    //                         </span>
    //                       </li>
    //                     </ul>
    //                   </div>
    //                   <div
    //                     className="person-identity"
    //                     style={{ border: "0px" }}
    //                   >
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         lineHeight: "0",
    //                         border: "1px solid #333",
    //                         padding: "20px 35px",
    //                         margin: 0,
    //                         display: "inline-block",
    //                       }}
    //                     >
    //                       <u>{thisOrder.orderId}</u>
    //                     </h2>
    //                     <p
    //                       style={{
    //                         fontSize: "10px",
    //                         lineHeight: "0",
    //                         textTransform: "uppercase",
    //                         textAlign: "center",
    //                       }}
    //                     >
    //                       <strong>{orderItem.item_code}</strong>
    //                     </p>
    //                   </div>
    //                   <div
    //                     className="person-upi-code"
    //                     style={{
    //                       border: "0px",
    //                       textAlign: "center",
    //                       justifyContent: "center",
    //                       alignItems: "flex-start",
    //                     }}
    //                   >
    //                     <img
    //                       src={mainQR}
    //                       className="img-fit"
    //                       style={{ width: "30%" }}
    //                     />
    //                   </div>
    //                 </div>
    //               </div>
    //               <div
    //                 className="mesurement-info"
    //                 style={{
    //                   border: "0",
    //                   paddingTop: "0",
    //                   paddingRight: "0",
    //                   paddingLeft: "0",
    //                   height: "auto",
    //                   marginBottom:"-10px",
    //                 }}
    //               >
    //                 <div className="info-col-5">
    //                   <div className="info-table" style={{ border: "0" }}>
    //                     <table
    //                       style={{
    //                         border: "1px solid #333",
    //                         borderTop: "0",
    //                         borderRight: "0",
    //                         borderBottom: "0",
    //                         borderCollapse: "collapse",
    //                         width: "100%",
    //                         height: "100%"
    //                       }}
    //                     >
    //                       <thead>
    //                         <tr style={{ padding: "0" }}>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               padding: "3px 0",
    //                               margin:"0",
    //                               lineHeight: "0px",
    //                             }}
    //                           ></th>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               padding: "3px 0",
    //                               verticalAlign: "middle",
    //                               margin:"0",
    //                               lineHeight: "0px",
    //                             }}
    //                           >
    //                             <span
    //                               style={{
    //                                 fontSize: "8px",
    //                                 display: "block",
    //                                 padding: "0",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
    //                                 borderBottom: "1px solid #333",
                                   
    //                               }}
    //                             >
    //                               Skin
    //                             </span>
    //                             <p
    //                               style={{
    //                                 fontSize: "8px",
    //                                 padding: "0",
    //                                 lineHeight: "0px",
    //                                 display: "inline-block",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
                                  
    //                               }}
    //                             >
    //                               thai
    //                             </p>
    //                           </th>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               padding: "3px 0",
    //                               verticalAlign: "middle",
    //                               margin:"0",
    //                               lineHeight: "0px",
    //                             }}
    //                           >
    //                             <span
    //                               style={{
    //                                 fontSize: "8px",
    //                                 display: "block",
    //                                 padding: "0",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
    //                                 borderBottom: "1px solid #333",
    //                               }}
    //                             >
    //                               Fit
    //                             </span>
    //                             <p
    //                               style={{
    //                                 fontSize: "8px",
    //                                 padding: "0",
    //                                 lineHeight: "0px",
    //                                 display: "inline-block",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
    //                               }}
    //                             >
    //                               thai
    //                             </p>
    //                           </th>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               padding: "3px 0",
    //                               verticalAlign: "middle",
    //                               margin:"0",
    //                               lineHeight: "0px",
    //                             }}
    //                           >
    //                             <span
    //                               style={{
    //                                 fontSize: "8px",
    //                                 display: "block",
    //                                 padding: "0",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
    //                                 borderBottom: "1px solid #333",
    //                               }}
    //                             >
    //                               TTL
    //                             </span>
    //                             <p
    //                               style={{
    //                                 fontSize: "8px",
    //                                 padding: "0",
    //                                 lineHeight: "0px",
    //                                 display: "inline-block",
    //                                 margin:"0",
    //                                 lineHeight: "10px",
    //                               }}
    //                             >
    //                               thai
    //                             </p>
    //                           </th>
    //                         </tr>
    //                       </thead>
    //                       <tbody>
    //                         {Object.keys(
    //                           orderItem.measurementsObject.measurements
    //                         ).map((measurement, i) => {
    //                           return (
    //                             <tr key={i}>
    //                               <th
    //                                 style={{
    //                                   borderRight: "1px solid #333",
    //                                   borderLeft: "1px solid #333",
    //                                   borderBottom: "1px solid #333",
    //                                   textAlign: "left",
    //                                   backgroundColor: "white",
    //                                   paddingLeft: "0.25rem",
    //                                   lineHeight:"0",
    //                                   margin: "0",
    //                                   padding:"0"
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "8px",
    //                                     lineHeight: "0",
    //                                     padding:"0",
    //                                     paddingLeft: "0.25rem",
    //                                     margin:"0",
    //                                     textTransform:'capitalize'
    //                                   }}
    //                                 >
    //                                   {measurement}
    //                                 </span>
    //                               </th>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #333",
    //                                   borderBottom: "1px solid #333",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   paddingLeft: "0.25rem",
    //                                   margin: "0",
    //                                   padding: "2px 0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "7px",
    //                                     lineHeight: "0",
    //                                     margin: "0",
    //                                     padding:"0"
    //                                   }}
    //                                 >
    //                                   {
    //                                     orderItem.measurementsObject
    //                                       .measurements[measurement].value
    //                                   }
    //                                 </span>
    //                               </td>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #333",
    //                                   borderBottom: "1px solid #333",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   paddingLeft: "0.25rem",
    //                                   margin: "0",
    //                                   padding: "2px 0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "7px",
    //                                     lineHeight: "0",
    //                                     margin: "0",
    //                                     padding:"0",
    //                                   }}
    //                                 >
    //                                   {
    //                                     orderItem.measurementsObject
    //                                       .measurements[measurement]
    //                                       .adjustment_value
    //                                   }
    //                                 </span>
    //                               </td>
    //                               <td
    //                                 style={{
    //                                   borderRight: "1px solid #333",
    //                                   borderBottom: "1px solid #333",
    //                                   textAlign: "center",
    //                                   backgroundColor: "white",
    //                                   paddingLeft: "0.25rem",
    //                                   margin: "0",
    //                                   padding: "2px 0",
    //                                 }}
    //                               >
    //                                 <span
    //                                   style={{
    //                                     fontSize: "7px",
    //                                     lineHeight: "0",
    //                                     margin: "0",
    //                                     padding:"0"
    //                                   }}
    //                                 >
    //                                   {
    //                                     orderItem.measurementsObject
    //                                       .measurements[measurement].total_value
    //                                   }
    //                                 </span>
    //                                 <strong>
    //                                     {
    //                                     orderItem['item_name'] !== 'suit'
    //                                     ?
    //                                     draftMeasurementsObj && draftMeasurementsObj[orderItem['item_name']] &&
    //                                       orderItem.measurementsObject.measurements[measurement].total_value !== draftMeasurementsObj[orderItem['item_name']]['measurements'][measurement]['total_value']
    //                                       ?
    //                                         "*"
    //                                       :
    //                                         ""
    //                                     :  
    //                                     draftMeasurementsObj && draftMeasurementsObj[orderItem['item_code'].split(" ")[0]] &&
    //                                     orderItem.measurementsObject.measurements[measurement].total_value !== draftMeasurementsObj[orderItem['item_code'].split(" ")[0]]['measurements'][measurement]['total_value']
    //                                     ?
    //                                       "*"
    //                                     :
    //                                       ""  
    //                                     }
    //                                   </strong>
    //                               </td>
    //                             </tr>
    //                           );
    //                         })}
    //                       </tbody>
    //                     </table>
    //                   </div>
    //                 </div>
    //                 <div className="info-col-7">
    //                   <div className="manual-info">
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         padding: "0.45rem",
    //                         color: "#000",
    //                         background: "#fff",
    //                         margin: 0
    //                       }}
    //                     >
    //                       Manual Size:
    //                     </h2>
    //                     <div className="img-box" style={{ height: "200px" }}>

    //                      { orderItem.item_name == 'suit'
    //                      ?
    //                      <img
    //                      src={orderItem.manualSize && orderItem.manualSize[orderItem['item_code'].split(" ")[0]] && orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
    //                        ?
    //                        PicBaseUrl + orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
    //                        :
    //                        PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
    //                     }
    //                     className="img-fit"
    //                     style={{ width: "440px", height: "200px" }}
    //                     />
    //                     :
    //                     <img
    //                     src={orderItem.manualSize && orderItem.manualSize.imagePic
    //                       ?
    //                       PicBaseUrl + orderItem.manualSize.imagePic
    //                       :
    //                       PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
    //                     }
    //                     className="img-fit"
    //                     style={{ width: "440px", height: "200px" }}
    //                   />
    //                     }
                       
    //                     </div>
    //                   </div>
    //                   <div
    //                     className="mesurement-note"
    //                     style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
    //                   >
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         paddingBottom: "0px",
    //                         backgroundColor: "white",
    //                         color: "#000",
    //                         wordSpacing: "0",
    //                         borderRight: "1px solid #333",
    //                         textAlign: "center",
    //                         width:'160px',
    //                         margin: 0,
    //                         lineHeight:"0",
    //                       }}
    //                     >
    //                       <strong>Measurement Note</strong>
    //                     </h2>
    //                     <p
    //                       style={{
    //                         fontSize: "10px",
    //                         paddingLeft: "0",
    //                         paddingTop: "0px",
    //                         textAlign: "center",
    //                         margin: 0,
    //                         lineHeight:"5px",
    //                         transform:"translateY(5px)"
                            
    //                       }}
    //                     >
    //                       {orderItem.measurementsObject.notes}
    //                     </p>
    //                   </div>
    //                   {
    //                     orderItem['measurementsObject']['shoulder_type']
    //                     ?
    //                     <div
    //                       className="mesurement-note"
    //                       style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px', overflow: "hidden" }}
    //                     >
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         paddingBottom: "10px",
    //                         backgroundColor: "white",
    //                         color: "#000",
    //                         wordSpacing: "0",
    //                         borderRight: "1px solid #333",
    //                         textAlign: "center",
    //                         width:'160px',
    //                         margin: 0
    //                       }}
    //                     >
    //                       <strong>Shoulder type</strong>
    //                     </h2>
    //                     <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['shoulder_type'][0].toUpperCase() + orderItem['measurementsObject']['shoulder_type'].slice(1)}</p>
    //                     <img style={{padding:'8px', height:"40px", width:'40px', filter: "drop-shadow(-5px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/jacket/" + orderItem['measurementsObject']['shoulder_type'] + ".png"} alt="" />
    //                   </div>
    //                   :
    //                   orderItem['measurementsObject']['pant_type']
    //                   ?

    //                   <div
    //                     className="mesurement-note"
    //                     style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
    //                   >
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         paddingBottom: "10px",
    //                         backgroundColor: "white",
    //                         color: "#000",
    //                         wordSpacing: "0",
    //                         borderRight: "1px solid #333",
    //                         textAlign: "center",
    //                         width:'160px',
    //                         margin: 0
    //                       }}
    //                     >
    //                       <strong>Pants type</strong>
    //                     </h2>
    //                     <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['pant_type'][0].toUpperCase() + orderItem['measurementsObject']['pant_type'].slice(1)}</p>
    //                     <img style={{padding:'8px', height:"40px", width:'40px', filter: "drop-shadow(0px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/pants/" + orderItem['measurementsObject']['pant_type'] + ".png"} alt="" />
    //                   </div>

    //                   :
    //                   <></>
                      
    //                   }
                     
    //                 </div>
    //               </div>
    //               <div
    //                 className="product-final-views"
    //                 style={{
    //                   padding: "0",
    //                   border: "0",
    //                   lineHeight: "0",
    //                   margin:"0",
    //                 }}
    //               >
    //                 <div
    //                   className="product-views"
    //                   style={{
    //                     padding: "0",
    //                     border: "1px solid #333",
    //                     lineHeight: "0",
    //                     margin:"0",
                       
    //                   }}
    //                 >
    //                   <div className="info-col-12">
    //                     <div
    //                       className="view-lists"
    //                       style={{
    //                         width: "100%",
    //                         padding: "5px 0 0 0",
    //                         border: "0",
    //                         lineHeight: "0",
    //                         margin:"0",
    //                       }}
    //                     >
    //                       <table
    //                         style={{
    //                           border: "0",
    //                           borderCollapse: "collapse",
    //                           padding: "0",
    //                           width: "100%",
    //                         }}
    //                       >
    //                         <thead>
    //                           <tr style={{ padding: "0" }}>
    //                             {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket"
    //                               ? productFeaturesObject["jacket"].map(
    //                                   (proFea) =>
    //                                     Object.keys(
    //                                       orderItem["styles"]["jacket"]["style"]
    //                                     ).map((data, i) => {
    //                                       if (
    //                                         orderItem["styles"]["jacket"][
    //                                           "style"
    //                                         ][data]["additional"] == "false" &&
    //                                         proFea == data
    //                                       ) {
    //                                         return (
    //                                           <th
    //                                             key={i}
    //                                             style={{
    //                                               border: "0",
    //                                               backgroundColor: "white",
    //                                               color: "#000",
    //                                               textAlign: "center",
    //                                               textTransform: "capitalize",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <span
    //                                               style={{
    //                                                 fontSize: "8px",
    //                                                 lineHeight: "0px",
    //                                                 margin: "0",
    //                                                 padding: "0",
    //                                               }}
    //                                             >
    //                                               {data}
    //                                             </span>
    //                                           </th>
    //                                         );
    //                                       }
    //                                     })
    //                                 )
    //                               : orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] == "pant"
    //                               ? productFeaturesObject["pant"].map(
    //                                   (proFea) =>
    //                                     Object.keys(
    //                                       orderItem["styles"]["pant"]["style"]
    //                                     ).map((data, i) => {
    //                                       if (
    //                                         orderItem["styles"]["pant"][
    //                                           "style"
    //                                         ][data]["additional"] == "false" &&
    //                                         proFea == data
    //                                       ) {
    //                                         return (
    //                                           <th
    //                                             key={i}
    //                                             style={{
    //                                               border: "0",
    //                                               backgroundColor: "white",
    //                                               color: "#000",
    //                                               textAlign: "center",
    //                                               textTransform: "capitalize",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <span
    //                                               style={{
    //                                                 fontSize: "8px",
    //                                                 lineHeight: "10px",
    //                                                 margin: "0",
    //                                                 padding: "0",
    //                                               }}
    //                                             >
    //                                               {data}
    //                                             </span>
    //                                           </th>
    //                                         );
    //                                       }
    //                                     })
    //                                 )
    //                               : productFeaturesObject[
    //                                   orderItem["item_name"]
    //                                 ].map((proFea) =>
    //                                   Object.keys(orderItem.styles.style).map(
    //                                     (data, i) => {
    //                                       if (
    //                                         orderItem["styles"]["style"][data][
    //                                           "additional"
    //                                         ] == "false" &&
    //                                         proFea == data
    //                                       ) {
    //                                         return (
    //                                           <th
    //                                             key={i}
    //                                             style={{
    //                                               border: "0",
    //                                               backgroundColor: "white",
    //                                               color: "#000",
    //                                               textAlign: "center",
    //                                               textTransform: "capitalize",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <span
    //                                               style={{
    //                                                 fontSize: "8px",
    //                                                 lineHeight: "10px",
    //                                                 margin: "0",
    //                                                 padding: "0",
    //                                               }}
    //                                             >
    //                                               {data}
    //                                             </span>
    //                                           </th>
    //                                         );
    //                                       }
    //                                     }
    //                                   )
    //                                 )}


    //                           {/* groupStyle */}
    //                           {
    //                              orderItem["styles"] && orderItem["styles"]["jacket"] && orderItem["styles"]["jacket"]["groupStyle"]
    //                               ? 
    //                               productFeaturesObject["jacket"].map(
    //                                   (proFea) =>
    //                                     Object.keys(
    //                                       orderItem["styles"]["jacket"]["groupStyle"]
    //                                     ).map((data, i) => {
    //                                       if (orderItem["styles"]["jacket"]["groupStyle"][data]["additional"] == "false" && proFea == data && orderItem.item_name == "suit" && orderItem.item_code.split(" ")[0] == "jacket") {
    //                                         return (
    //                                           <th
    //                                             key={i}
    //                                             style={{
    //                                               border: "0",
    //                                               backgroundColor: "white",
    //                                               color: "#000",
    //                                               textAlign: "center",
    //                                               textTransform: "capitalize",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <span
    //                                               style={{
    //                                                 fontSize: "8px",
    //                                                 lineHeight: "0px",
    //                                                 margin: "0",
    //                                                 padding: "0",
    //                                               }}
    //                                             >
    //                                               {data}
    //                                             </span>
    //                                           </th>
    //                                         );
    //                                       }
    //                                     })
    //                                 )
    //                               : 
    //                               orderItem["styles"] && orderItem["styles"]["pant"] && orderItem["styles"]["pant"]["groupStyle"]
    //                               ? 
    //                               productFeaturesObject["pant"].map(
    //                                   (proFea) =>
    //                                     Object.keys(
    //                                       orderItem["styles"]["pant"]["groupStyle"]
    //                                     ).map((data, i) => {
    //                                       if (orderItem["styles"]["pant"]["groupStyle"][data]["additional"] == "false" && proFea == data && orderItem.item_name == "suit" && orderItem.item_code.split(" ")[0] == "pant") {
    //                                         return (
    //                                           <th
    //                                             key={i}
    //                                             style={{
    //                                               border: "0",
    //                                               backgroundColor: "white",
    //                                               color: "#000",
    //                                               textAlign: "center",
    //                                               textTransform: "capitalize",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <span
    //                                               style={{
    //                                                 fontSize: "8px",
    //                                                 lineHeight: "10px",
    //                                                 margin: "0",
    //                                                 padding: "0",
    //                                               }}
    //                                             >
    //                                               {data}
    //                                             </span>
    //                                           </th>
    //                                         );
    //                                       }
    //                                     })
    //                                 )
    //                               : productFeaturesObject[
    //                                   orderItem["item_name"]
    //                                 ].map((proFea) =>
    //                                   Object.keys(
    //                                     orderItem.styles.groupStyle
    //                                   ).map((data, i) => {
    //                                     if (orderItem["styles"]["groupStyle"][data][
    //                                       "additional"
    //                                     ] == "false" &&
    //                                     proFea == data) {
    //                                       return (
    //                                         <th
    //                                           key={i}
    //                                           style={{
    //                                             border: "0",
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             textTransform: "capitalize",
    //                                             margin: "0",
    //                                             padding: "0",
    //                                           }}
    //                                         >
    //                                           <span
    //                                             style={{
    //                                               fontSize: "8px",
    //                                               lineHeight: "10px",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             {data}
    //                                           </span>
    //                                         </th>
    //                                       );
    //                                     }
    //                                   })
    //                                 )}
    //                           </tr>
    //                         </thead>
    //                         <tbody>
    //                           {orderItem.item_name == "suit" &&
    //                           orderItem.item_code.split(" ")[0] == "jacket"
    //                             ? productFeaturesObject["jacket"].map(
    //                                 (proFea) =>
    //                                   Object.keys(
    //                                     orderItem["styles"]["jacket"]["style"]
    //                                   ).map((data, i) => {
    //                                     if (
    //                                       orderItem["styles"]["jacket"][
    //                                         "style"
    //                                       ][data]["additional"] == "false" &&
    //                                       proFea == data
    //                                     ) {
    //                                       return (
    //                                         <td
    //                                           key={i}
    //                                           align="center"
    //                                           style={{
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             padding: "0",
    //                                             margin: "0",
    //                                           }}
    //                                         >
    //                                           <div
    //                                             className="img-box"
    //                                             style={{
    //                                               lineHeight: "0",
    //                                               padding: "0",
    //                                               margin: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <img
    //                                               src={
    //                                                 PicBaseUrl +
    //                                                 orderItem["styles"][
    //                                                   "jacket"
    //                                                 ]["style"][data]["image"]
    //                                               }
    //                                               className="img-fit"
    //                                               style={{
    //                                                 width: "40px",
    //                                                 height: "40px",
    //                                                 margin: "5px 0",
    //                                                 padding: "0",
    //                                                 transform: "translateY(5px)",
    //                                               }}
    //                                             />
    //                                           </div>
    //                                           <p
    //                                             style={{
    //                                               fontSize: "8px",
    //                                               lineHeight: "0",
    //                                               textAlign: "center",
    //                                             }}
    //                                           >
    //                                             {
    //                                               orderItem["styles"]["jacket"][
    //                                                 "style"
    //                                               ][data]["value"]
    //                                             }
    //                                           </p>
    //                                         </td>
    //                                       );
    //                                     }
    //                                   })
    //                               )
    //                             : orderItem.item_name == "suit" &&
    //                               orderItem.item_code.split(" ")[0] == "pant"
    //                             ? productFeaturesObject["pant"].map((proFea) =>
    //                                 Object.keys(
    //                                   orderItem["styles"]["pant"]["style"]
    //                                 ).map((data, i) => {
    //                                   if (
    //                                     orderItem["styles"]["pant"]["style"][
    //                                       data
    //                                     ]["additional"] == "false" &&
    //                                     proFea == data
    //                                   ) {
    //                                     return (
    //                                       <td
    //                                         key={i}
    //                                         align="center"
    //                                         style={{
    //                                           backgroundColor: "white",
    //                                           color: "#000",
    //                                           textAlign: "center",
    //                                           padding: "0",
    //                                         }}
    //                                       >
    //                                         <div
    //                                           className="img-box"
    //                                           style={{
    //                                             lineHeight: "0",
    //                                             padding: "0",
    //                                           }}
    //                                         >
    //                                           <img
    //                                             src={
    //                                               PicBaseUrl +
    //                                               orderItem["styles"]["pant"][
    //                                                 "style"
    //                                               ][data]["image"]
    //                                             }
    //                                             className="img-fit"
    //                                             style={{
    //                                               width: "40px",
    //                                               height: "40px",
    //                                               margin: "5px 0",
    //                                               padding: "0",
    //                                               transform: "translateY(5px)",
    //                                             }}
    //                                           />
    //                                         </div>
    //                                         <p
    //                                           style={{
    //                                             fontSize: "8px",
    //                                             lineHeight: "0",
    //                                             textAlign: "center",
    //                                           }}
    //                                         >
    //                                           {
    //                                             orderItem["styles"]["pant"][
    //                                               "style"
    //                                             ][data]["value"]
    //                                           }
    //                                         </p>
    //                                       </td>
    //                                     );
    //                                   }
    //                                 })
    //                               )
    //                             : productFeaturesObject[
    //                                 orderItem["item_name"]
    //                               ].map((proFea) =>
    //                                 Object.keys(orderItem.styles.style).map(
    //                                   (data, i) => {
    //                                     if (
    //                                       orderItem["styles"]["style"][data][
    //                                         "additional"
    //                                       ] == "false" &&
    //                                       proFea == data
    //                                     ) {
    //                                       return (
    //                                         <td
    //                                           key={i}
    //                                           align="center"
    //                                           style={{
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             padding: "0",
    //                                           }}
    //                                         >
    //                                           <div
    //                                             className="img-box"
    //                                             style={{
    //                                               lineHeight: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <img
    //                                               src={
    //                                                 PicBaseUrl +
    //                                                 orderItem.styles.style[
    //                                                   data
    //                                                 ]["image"]
    //                                               }
    //                                               className="img-fit"
    //                                               style={{
    //                                                 width: "40px",
    //                                                 height: "40px",
    //                                                 margin: "5px 0",
    //                                                 padding: "0",
    //                                                 transform:
    //                                                   "translateY(5px)",
    //                                               }}
    //                                             />
    //                                           </div>
    //                                           <p
    //                                             style={{
    //                                               fontSize: "8px",
    //                                               lineHeight: "0",
    //                                               textAlign: "center",
    //                                             }}
    //                                           >
    //                                             {
    //                                               orderItem.styles.style[data][
    //                                                 "value"
    //                                               ]
    //                                             }
    //                                           </p>
    //                                         </td>
    //                                       );
    //                                     }
    //                                   }
    //                                 )
    //                               )}

    //                           {/* groupStyle */}

    //                           { 
    //                               orderItem["styles"] && orderItem["styles"]["jacket"] && orderItem["styles"]["jacket"]["groupStyle"]
    //                               ? 
    //                               productFeaturesObject['jacket'].map((proFea) =>(
    //                               Object.keys(
    //                                 orderItem["styles"]["jacket"]["groupStyle"]
    //                               ).map((data, i) => {
    //                                 if(orderItem["styles"]["jacket"]["groupStyle"][data]["additional"] == "false" && proFea == data && orderItem.item_name == "suit" && orderItem.item_code.split(" ")[0] == "jacket"){
    //                                   return (
    //                                     <td
    //                                       key={i}
    //                                       align="center"
    //                                       style={{
    //                                         backgroundColor: "white",
    //                                         color: "#000",
    //                                         textAlign: "center",
    //                                         padding: "0",
    //                                         margin:"0",
                                            
    //                                       }}
    //                                     >
    //                                       <div
    //                                         className="img-box"
    //                                         style={{
    //                                           lineHeight: "0",
    //                                           padding: "0",
    //                                           margin:"0",
    //                                           padding:"0",
    //                                         }}
    //                                       >
    //                                         <img
    //                                           src={
    //                                             PicBaseUrl +
    //                                             orderItem["styles"]["jacket"]["groupStyle"][data][
    //                                             "image"
    //                                             ]
    //                                           }
    //                                           className="img-fit"
    //                                           style={{
    //                                             width: "40px",
    //                                             height: "40px",
    //                                             margin: "5px 0",
    //                                             padding: "0",
    //                                             transform:"translateY(5px)"
    //                                           }}
    //                                         />
    //                                       </div>
    //                                       <p
    //                                         style={{
    //                                           fontSize: "8px",
    //                                           lineHeight: "0",
    //                                           textAlign: "center",
    //                                         }}
    //                                       >
    //                                         {
    //                                           orderItem["styles"]["jacket"]["groupStyle"][data][
    //                                           "value"
    //                                           ]
    //                                         }
    //                                       </p>
    //                                     </td>
    //                                   );
    //                                 }
    //                               })
    //                             ))
    //                               : 
    //                                 orderItem["styles"] && orderItem["styles"]["pant"] && orderItem["styles"]["pant"]["groupStyle"]
    //                                 ? 
    //                                 productFeaturesObject['pant'].map((proFea) =>(
    //                                 Object.keys(orderItem["styles"]["pant"]["groupStyle"]).map(
    //                                   (data, i) => {
    //                                     if(orderItem["styles"]["pant"]["groupStyle"][data]["additional"] == "false" && proFea == data && orderItem.item_name == "suit" && orderItem.item_code.split(" ")[0] == "pant"){
    //                                       return (
    //                                         <td
    //                                           key={i}
    //                                           align="center"
    //                                           style={{
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             padding: "0",
    //                                           }}
    //                                         >
    //                                           <div
    //                                             className="img-box"
    //                                             style={{
    //                                               lineHeight: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <img
    //                                               src={
    //                                                 PicBaseUrl +
    //                                                 orderItem["styles"]["pant"]["groupStyle"][data][
    //                                                 "image"
    //                                                 ]
    //                                               }
    //                                               className="img-fit"
    //                                               style={{
    //                                                 width: "40px",
    //                                             height: "40px",
    //                                             margin: "5px 0",
    //                                             padding: "0",
    //                                             transform:"translateY(5px)"
    //                                               }}
    //                                             />
    //                                           </div>
    //                                           <p
    //                                             style={{
    //                                               fontSize: "8px",
    //                                               lineHeight: "0",
    //                                               textAlign: "center",
    //                                             }}
    //                                           >
    //                                             {
    //                                               orderItem["styles"]["pant"]["groupStyle"][data][
    //                                               "value"
    //                                               ]
    //                                             }
    //                                           </p>
    //                                         </td>
    //                                       );
    //                                     }
    //                                   }
    //                                 )
    //                                 ))
    //                                 : 
    //                                 productFeaturesObject[orderItem['item_name']].map((proFea) =>(
    //                                 Object.keys(orderItem.styles.groupStyle).map(
    //                                   (data, i) => {
    //                                     if(orderItem["styles"]["groupStyle"][data]["additional"] == "false" && proFea == data){
    //                                       return (
    //                                         <td
    //                                           key={i}
    //                                           align="center"
    //                                           style={{
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             padding: "0",
    //                                           }}
    //                                         >
    //                                           <div
    //                                             className="img-box"
    //                                             style={{
    //                                               lineHeight: "0",
    //                                               padding: "0",
    //                                             }}
    //                                           >
    //                                             <img
    //                                               src={
    //                                                 PicBaseUrl +
    //                                                 orderItem["styles"]["groupStyle"][data][
    //                                                 "image"
    //                                                 ]
    //                                               }
    //                                               className="img-fit"
    //                                               style={{
    //                                                 width: "40px",
    //                                                 height: "40px",
    //                                                 margin: "5px 0",
    //                                                 padding: "0",
    //                                                 transform:"translateY(5px)"
    //                                               }}
    //                                             />
    //                                           </div>
    //                                           <p
    //                                             style={{
    //                                               fontSize: "8px",
    //                                               lineHeight: "0",
    //                                               textAlign: "center",
    //                                             }}
    //                                           >
    //                                             {
    //                                               orderItem["styles"]["groupStyle"][data][
    //                                               "value"
    //                                               ]
    //                                             }
    //                                           </p>
    //                                         </td>
    //                                       );
    //                                     }
                                        
    //                                   }
    //                                 )
    //                                 ))
    //                                 }
    //                         </tbody>
    //                       </table>
    //                     </div>
    //                   </div>
    //                 </div>
    //               </div>
    //             </div>
    //             <div className="product-styling" style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
    //               {/* <h3
    //                 style={{
    //                   paddingBottom: "5px",
    //                   textAlign: "center",
    //                   fontSize: "10px",
    //                   textTransform: "uppercase",
    //                   width: "100%",
    //                   margin: 0
    //                 }}
    //               >
    //                 Siam Suits Supply
    //               </h3> */}
    //               <div
    //                 className="order-header"
    //                 style={{ paddingLeft: "0px", paddingBottom: "0" }}
    //               >
    //                 <div className="person-details" style={{ padding: "0px" }}>
    //                   <div
    //                     className="details-group"
    //                     style={{ border: "0px", paddingLeft: "0px" }}
    //                   >
    //                     <ul style={{ paddingLeft: "0px" }}>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Name:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             {thisOrder.customerName}
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Order Date:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             {thisOrder.orderDate}
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           QTY:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             1 OF 2
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li style={{ border: "0px" }}>
    //                         <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
    //                           Old Order:{" "}
    //                           <span
    //                             style={{
    //                               fontSize: "10px",
    //                               lineHeight: "0",
    //                               textTransform: "capitalize",
    //                               wordSpacing: "-2px",
    //                               paddingLeft: "3px",
    //                               letterSpacing: "0px",
    //                             }}
    //                           >
    //                             No Orders
    //                           </span>
    //                         </h4>
    //                       </li>
    //                       <li
    //                         style={{
    //                           border: "0",
    //                           textAlign: "right",
    //                           justifyContent: "end",
    //                           marginTop: "10px",
    //                         }}
    //                       >
    //                         <span
    //                           style={{
    //                             fontSize: "10px",
    //                             lineHeight: "0",
    //                             textAlign: "right",
    //                           }}
    //                         >
    //                           Male(malethai)
    //                         </span>
    //                       </li>
    //                     </ul>
    //                   </div>
    //                   <div
    //                     className="person-identity"
    //                     style={{ border: "0px" }}
    //                   >
    //                     <h2
    //                       style={{
    //                         fontSize: "10px",
    //                         lineHeight: "0",
    //                         border: "1px solid #333",
    //                         padding: "20px 35px",
    //                         display: "inline-block",
    //                         margin: 0
    //                       }}
    //                     >
    //                       <u>{thisOrder.orderId}</u>
    //                     </h2>
    //                     <p
    //                       style={{
    //                         fontSize: "10px",
    //                         lineHeight: "0",
    //                         textTransform: "uppercase",
    //                         textAlign: "center",
    //                       }}
    //                     >
    //                       <strong>{orderItem.item_code}</strong>
    //                     </p>
    //                   </div>
    //                   <div
    //                     className="person-upi-code"
    //                     style={{
    //                       border: "0px",
    //                       textAlign: "center",
    //                       justifyContent: "center",
    //                       alignItems: "flex-start",
    //                     }}
    //                   >
    //                     <img
    //                       src={mainQR}
    //                       className="img-fit"
    //                       style={{ width: "30%" }}
    //                     />
    //                   </div>
    //                 </div>
    //               </div>
    //               <div
    //                 className="product-final-views"
    //                 style={{
    //                   padding: "0",
    //                   border: "0",
    //                   lineHeight: "0",
    //                   margin:"1rem 0",
    //                 }}
    //               >
    //                 <div
    //                   className="product-views"
    //                   style={{
    //                     padding: "0",
    //                     lineHeight: "0",
    //                     margin:"0",
                       
    //                   }}
    //                 >
    //                     <div className="info-col-5">
    //                     <div className="info-table" style={{ border: "0" }}>
    //                       <table
    //                         style={{
    //                           border: "1px solid #333",
    //                           borderTop: "0",
    //                           borderRight: "0",
    //                           borderBottom: "0",
    //                           borderCollapse: "collapse",
    //                           width: "100%",
    //                           height: "100%"
    //                         }}
    //                       >
    //                         <thead>
    //                           {/* <tr style={{ padding: "0" }}>


                                
                                
    //                             <th
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 padding: "3px 0",
    //                                 verticalAlign: "middle",
    //                                 margin:"0",
    //                                 lineHeight: "0px",
    //                               }}
    //                             >
                                  
    //                               <span
    //                                 style={{
    //                                   fontSize: "8px",
    //                                   display: "block",
    //                                   padding: "0",
    //                                   margin:"0",
    //                                   lineHeight: "10px",
                                    
    //                                 }}
    //                               >
    //                                 Additional Style Name
    //                               </span>
                                 
    //                             </th>
    //                             <th
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 padding: "3px 0",
    //                                 verticalAlign: "middle",
    //                                 margin:"0",
    //                                 lineHeight: "0px",
    //                               }}
    //                             >
    //                               <span
    //                                 style={{
    //                                   fontSize: "8px",
    //                                   display: "block",
    //                                   padding: "0",
    //                                   margin:"0",
    //                                   lineHeight: "10px",
    //                                 }}
    //                               >
    //                                 Additional Style Value
    //                               </span>
    //                             </th>
    //                           </tr> */}
    //                         </thead>
    //                         <tbody>
    //                         {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket"
    //                             ? Object.keys(
    //                               orderItem["styles"]["jacket"]["style"]
    //                             ).map((data, i) => {
    //                               if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
    //                                 return (
    //                                   <tr key={i}  >
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderLeft: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0"
    //                                         }}
    //                                       >
    //                                         {data}
    //                                       </span>
    //                                     </td>
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0",
    //                                         }}
    //                                       >
    //                                         {orderItem["styles"]["jacket"]["style"][data][
    //                                                 "value"
    //                                                 ]}
    //                                       </span>
    //                                     </td>
    //                                   </tr>
    //                                 );
    //                               }
                                  
    //                             })
    //                             : orderItem.item_name == "suit" &&
    //                               orderItem.item_code.split(" ")[0] == "pant"
    //                               ? Object.keys(orderItem["styles"]["pant"]["style"]).map(
    //                                 (data, i) => {
    //                                   if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
    //                                     return (
    //                                       <tr key={i} >
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderLeft: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0"
    //                                         }}
    //                                       >
    //                                         {data}
    //                                       </span>
    //                                     </td>
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0",
    //                                         }}
    //                                       >
    //                                         {orderItem["styles"]["pant"]["style"][data][
    //                                                 "value"
    //                                                 ]}
    //                                       </span>
    //                                     </td>
    //                                   </tr>
    //                                     );
    //                                   }
                                      
    //                                 }
    //                               )
    //                               : Object.keys(orderItem.styles.style).map(
    //                                 (data, i) => {
    //                                   if(orderItem['styles']['style'][data]['additional'] == 'true'){
    //                                 return (
    //                                   <tr key={i} >
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderLeft: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0"
    //                                         }}
    //                                       >
    //                                         {data}
    //                                       </span>
    //                                     </td>
    //                                     <td
    //                                       style={{
    //                                         borderRight: "1px solid #333",
    //                                         borderTop: "1px solid #333",
    //                                         borderBottom: "1px solid #333",
    //                                         textAlign: "center",
    //                                         backgroundColor: "white",
    //                                         paddingLeft: "0.25rem",
    //                                         margin: "0",
    //                                         padding: "2px 0",
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "7px",
    //                                           lineHeight: "0",
    //                                           margin: "0",
    //                                           padding:"0",
    //                                         }}
    //                                       >
    //                                         {
    //                                             orderItem.styles.style[data][
    //                                             "value"
    //                                             ]
    //                                           }
    //                                       </span>
    //                                     </td>
    //                                   </tr>
    //                                     );
    //                                   }
    //                                 }
    //                               )}
    //                         </tbody>
    //                       </table>
    //                     </div>
    //                   </div>

    //                   {/* <div className="info-col-12">
    //                     <div
    //                       className="view-lists"
    //                       style={{
    //                         width: "100%",
    //                         padding: "10px 0",
    //                         border: "0",
    //                         lineHeight: "0",
    //                       }}
    //                     >
    //                       <table
    //                         style={{
    //                           border: "0",
    //                           borderCollapse: "collapse",
    //                           padding: "0",
    //                           width: "100%",
    //                         }}
    //                       >
    //                         <thead>
    //                           <tr style={{ padding: "0" }}>
    //                             {orderItem.item_name == "suit" &&
    //                               orderItem.item_code.split(" ")[0] == "jacket"
    //                               ? Object.keys(
    //                                 orderItem["styles"]["jacket"]["style"]
    //                               ).map((data, i) => {
    //                                 if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
    //                                   return (
    //                                     <th
    //                                       key={i}
    //                                       style={{
    //                                         border: "0",
    //                                         backgroundColor: "white",
    //                                         color: "#000",
    //                                         textAlign: "center",
    //                                         textTransform: "capitalize",
    //                                         margin:"0",
    //                                         padding:"0",
    //                                         border: "1px solid #333",
                                            
                                          
    //                                       }}
    //                                     >
    //                                       <span
    //                                         style={{
    //                                           fontSize: "10px",
    //                                           lineHeight: "20px",
    //                                           margin:"0",
    //                                           padding:"0 0 10px 0",
    //                                           fontWeight: "600",
                                            
                                             
    //                                         }}
    //                                       >
    //                                         {data}
    //                                       </span>
    //                                     </th>
    //                                   );
    //                                 }
                                   
    //                               })
    //                               : orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] == "pant"
    //                                 ? Object.keys(
    //                                   orderItem["styles"]["pant"]["style"]
    //                                 ).map((data, i) => {
    //                                   if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
    //                                     return (
    //                                       <th
    //                                         key={i}
    //                                         style={{
    //                                           border: "0",
    //                                           backgroundColor: "white",
    //                                           color: "#000",
    //                                           textAlign: "center",
    //                                           textTransform: "capitalize",
    //                                           margin:"0",
    //                                           padding:"0",
    //                                           border: "1px solid #333",
                                             
                                             
    //                                         }}
    //                                       >
    //                                         <span
    //                                           style={{
    //                                             fontSize: "10px",
    //                                             lineHeight: "20px",
    //                                             margin:"0",
    //                                             padding:"0 0 10px 0",
    //                                             fontWeight: "600",
                                              
                                              
    //                                           }}
    //                                         >
    //                                           {data}
    //                                         </span>
    //                                       </th>
    //                                     );
    //                                   }
                                      
    //                                 })
    //                                 : Object.keys(orderItem.styles.style).map(
    //                                   (data, i) => {
    //                                     if(orderItem['styles']['style'][data]['additional'] == 'true'){
    //                                       return (
    //                                         <th
    //                                           key={i}
    //                                           style={{
    //                                             border: "0",
    //                                             backgroundColor: "white",
    //                                             color: "#000",
    //                                             textAlign: "center",
    //                                             textTransform: "capitalize",
    //                                             margin:"0",
    //                                             padding:"0",
    //                                             border: "1px solid #333",
                                            
                                               
    //                                           }}
    //                                         >
    //                                           <span
    //                                             style={{
    //                                               fontSize: "10px",
    //                                               lineHeight: "20px",
    //                                               margin:"0",
    //                                               padding:"0 0 10px 0",
    //                                               fontWeight: "600",
                                                 
                                                 
    //                                             }}
    //                                           >
    //                                             {data}
    //                                           </span>
    //                                         </th>
    //                                       );
    //                                     }
                                        
    //                                   }
    //                                 )}
    //                           </tr>
    //                         </thead>
    //                         <tbody>
    //                           {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket"
    //                             ? Object.keys(
    //                               orderItem["styles"]["jacket"]["style"]
    //                             ).map((data, i) => {
    //                               if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
    //                                 return (
    //                                   <td
    //                                     key={i}
    //                                     align="center"
    //                                     style={{
    //                                       backgroundColor: "white",
    //                                       color: "#000",
    //                                       textAlign: "center",
    //                                       padding: "5px 0",
    //                                       margin:"0",
    //                                       border: "1px solid #333",
                                          
    //                                     }}
    //                                   >
    //                                     <p
    //                                       style={{
    //                                         fontSize: "9px",
    //                                         lineHeight: "0",
    //                                         textAlign: "center",
    //                                       }}
    //                                     >
    //                                       {
    //                                         orderItem["styles"]["jacket"]["style"][data][
    //                                         "value"
    //                                         ]
    //                                       }
    //                                     </p>
    //                                   </td>
    //                                 );
    //                               }
                                  
    //                             })
    //                             : orderItem.item_name == "suit" &&
    //                               orderItem.item_code.split(" ")[0] == "pant"
    //                               ? Object.keys(orderItem["styles"]["pant"]["style"]).map(
    //                                 (data, i) => {
    //                                   if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
    //                                     return (
    //                                       <td
    //                                         key={i}
    //                                         align="center"
    //                                         style={{
    //                                           backgroundColor: "white",
    //                                           color: "#000",
    //                                           textAlign: "center",
    //                                           padding: "5px 0",
    //                                           border: "1px solid #333",
    //                                         }}
    //                                       >
    //                                         <p
    //                                           style={{
    //                                             fontSize: "9px",
    //                                             lineHeight: "0",
    //                                             textAlign: "center",
    //                                           }}
    //                                         >
    //                                           {
    //                                             orderItem["styles"]["pant"]["style"][data][
    //                                             "value"
    //                                             ]
    //                                           }
    //                                         </p>
    //                                       </td>
    //                                     );
    //                                   }
                                      
    //                                 }
    //                               )
    //                               : Object.keys(orderItem.styles.style).map(
    //                                 (data, i) => {
    //                                   if(orderItem['styles']['style'][data]['additional'] == 'true'){
    //                                     return (
    //                                       <td
    //                                         key={i}
    //                                         align="center"
    //                                         style={{
    //                                           backgroundColor: "white",
    //                                           color: "#000",
    //                                           textAlign: "center",
    //                                           padding: "5px 0",
    //                                            border: "1px solid #333",
    //                                         }}
    //                                       >
    //                                         <p
    //                                           style={{
    //                                             fontSize: "9px",
    //                                             lineHeight: "0",
    //                                             textAlign: "center",
    //                                           }}
    //                                         >
    //                                           {
    //                                             orderItem.styles.style[data][
    //                                             "value"
    //                                             ]
    //                                           }
    //                                         </p>
    //                                       </td>
    //                                     );
    //                                   }
    //                                 }
    //                               )}
    //                         </tbody>
    //                       </table>
    //                     </div>
    //                   </div> */}
    //                 </div>
    //               </div>
    //               <div
    //                 className="monogram-views"
    //                 style={{ border: "0", paddingTop: "10px", margin: "0" }}
    //               >
    //                 <div className="info-col-5">
    //                   { orderItem.item_code.split(" ")[0] == "pant" ?
    //                   <></>
    //                   :
    //                   <div
    //                     className="monogram-table"
    //                     style={{ width: "100%", border: "0", padding: "0" }}
    //                   >
    //                     <table
    //                       width="100%"
    //                       style={{
    //                         width: "100%",
    //                         border: "1px solid #333",
    //                         borderRight: "0",
    //                         borderBottom: "0",
    //                         borderTop: "0",
    //                         borderCollapse: "collapse",
    //                       }}
    //                     >
    //                       <thead>
    //                         <tr style={{ padding: "0.35rem 0 0.55rem 0" }}>
    //                           <th
    //                             colSpan="2"
    //                             align="center"
    //                             style={{
    //                               borderTop: "1px solid #333",
    //                               borderRight: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span style={{ fontSize: "10px" }}>
    //                               Monogram
    //                             </span>
    //                           </th>
    //                         </tr>
    //                       </thead>
    //                       <tbody>
    //                         <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               Position
    //                             </span>
    //                           </th>
    //                           <td
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               padding: "0.35rem 0 0.45rem 0",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               {orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] ==
    //                                 "jacket" &&
    //                                 orderItem["styles"]["jacket"]["monogram"] !==
    //                                 undefined
    //                                 ? orderItem["styles"]["jacket"]["monogram"][
    //                                 "side"
    //                                 ]
    //                                 : orderItem["styles"]["monogram"] !==
    //                                   undefined
    //                                   ? orderItem["styles"]["monogram"]["side"]
    //                                   : ""}
    //                             </span>
    //                           </td>
    //                         </tr>
    //                         <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               Style
    //                             </span>
    //                           </th>
    //                           <td
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               {orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] ==
    //                                 "jacket" &&
    //                                 orderItem["styles"]["jacket"]["monogram"] !==
    //                                 undefined
    //                                 ? orderItem["styles"]["jacket"]["monogram"][
    //                                 "font"
    //                                 ]
    //                                 : orderItem["styles"]["monogram"] !==
    //                                   undefined
    //                                   ? orderItem["styles"]["monogram"]["font"]
    //                                   : ""}
    //                             </span>
    //                           </td>
    //                         </tr>
    //                         <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
    //                           <th
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               Font Color
    //                             </span>
    //                           </th>
    //                           <td
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               {orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] ==
    //                                 "jacket" &&
    //                                 orderItem["styles"]["jacket"]["monogram"] !==
    //                                 undefined
    //                                 ? orderItem["styles"]["jacket"]["monogram"][
    //                                 "color"
    //                                 ]
    //                                 : orderItem["styles"]["monogram"] !==
    //                                   undefined
    //                                   ? orderItem["styles"]["monogram"]["color"]
    //                                   : ""}
    //                             </span>
    //                           </td>
    //                         </tr>
    //                         <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
    //                           <td
    //                             colSpan="2"
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               Monogram Name :{" "}
    //                               {orderItem.item_name == "suit" &&
    //                                 orderItem.item_code.split(" ")[0] ==
    //                                 "jacket" &&
    //                                 orderItem["styles"]["jacket"]["monogram"] !==
    //                                 undefined
    //                                 ? orderItem["styles"]["jacket"]["monogram"][
    //                                 "tag"
    //                                 ]
    //                                 : orderItem["styles"]["monogram"] !==
    //                                   undefined
    //                                   ? orderItem["styles"]["monogram"]["tag"]
    //                                   : ""}
    //                             </span>
    //                           </td>
    //                         </tr>
    //                         <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
    //                           <td
    //                             colSpan="2"
    //                             style={{
    //                               borderRight: "1px solid #333",
    //                               borderBottom: "1px solid #333",
    //                               borderLeft: "1px solid #333",
    //                               backgroundColor: "white",
    //                               color: "#000",
    //                               textAlign: "center",
    //                               lineHeight: "0",
    //                               verticalAlign: "middle",
    //                             }}
    //                           >
    //                             <span
    //                               style={{ fontSize: "10px", lineHeight: "0" }}
    //                             >
    //                               Optional:
    //                             </span>
    //                           </td>
    //                         </tr>
    //                       </tbody>
    //                     </table>
    //                   </div> }
                     
    //                 </div>
    //                 <div className="info-col-7">
    //                 <div
    //                     className="manual-views-table"
    //                     style={{ border: "0", marginLeft: "30px" }}
    //                   >
    //                     <table
    //                       style={{
    //                         border: "1px solid #333",
    //                         borderRight: "0",
    //                         borderBottom: "0",
    //                         borderTop: "0",
    //                         borderCollapse: "collapse",
    //                       }}
    //                     >
    //                       <thead>
    //                         <tr style={{ padding: "0.5rem " }}>
    //                           {orderItem.styles.fabric_code !== undefined ? (
    //                             <th
    //                               style={{
    //                                 borderTop: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 verticalAlign: "middle",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 Fabric
    //                               </span>
    //                             </th>
    //                           ) : (
    //                             <></>
    //                           )}
    //                           {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket" &&
    //                             orderItem.styles.jacket.lining_code !==
    //                             undefined ? (
    //                             <th
    //                               style={{
    //                                 borderTop: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 verticalAlign: "middle",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 Lining
    //                               </span>
    //                             </th>
    //                           ) : orderItem.styles.lining_code !== undefined ? (
    //                             <th
    //                               style={{
    //                                 borderTop: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 verticalAlign: "middle",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 Lining
    //                               </span>
    //                             </th>
    //                           ) : (
    //                             <></>
    //                           )}
    //                           {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket" &&
    //                             orderItem.styles.jacket.piping !== undefined ? (
    //                             <th
    //                               style={{
    //                                 borderTop: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 verticalAlign: "middle",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 Piping
    //                               </span>
    //                             </th>
    //                           ) : orderItem.styles.piping !== undefined ? (
    //                             <th
    //                               style={{
    //                                 borderTop: "1px solid #333",
    //                                 borderRight: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 verticalAlign: "middle",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 Piping
    //                               </span>
    //                             </th>
    //                           ) : (
    //                             <></>
    //                           )}
    //                         </tr>
    //                       </thead>
    //                       <tbody>
    //                         <tr style={{ padding: "0.1rem 0 0.5rem 0" }}>
    //                           {orderItem.styles.fabric_code !== undefined ? (
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 {orderItem.styles.fabric_code}
    //                               </span>
    //                             </td>
    //                           ) : (
    //                             <></>
    //                           )}
    //                           {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket" &&
    //                             orderItem.styles.jacket.lining_code !==
    //                             undefined ? (
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 {orderItem.styles.jacket.lining_code}
    //                               </span>
    //                             </td>
    //                           ): orderItem.styles.lining_code !== undefined ? (
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 {orderItem.styles.lining_code}
    //                               </span>
    //                             </td>
    //                           ) : (
    //                             <></>
    //                           )}
    //                           {orderItem.item_name == "suit" &&
    //                             orderItem.item_code.split(" ")[0] == "jacket" &&
    //                             orderItem.styles.jacket.piping !== undefined ? (
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 {orderItem.styles.jacket.piping}
    //                               </span>
    //                             </td>
    //                           ): orderItem.styles.piping !== undefined ? (
    //                             <td
    //                               style={{
    //                                 borderRight: "1px solid #333",
    //                                 borderBottom: "1px solid #333",
    //                                 borderLeft: "1px solid #333",
    //                                 backgroundColor: "white",
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                                 lineHeight: "4px",
    //                               }}
    //                             >
    //                               <span style={{ fontSize: "10px" }}>
    //                                 {orderItem.styles.piping}
    //                               </span>
    //                             </td>
    //                           ) : (
    //                             <></>
    //                           )}
    //                         </tr>
    //                       </tbody>
    //                     </table>
    //                   </div>
    //                   <div
    //                     className="notes"
    //                     style={{
    //                       paddingTop: "10px",
    //                       height: "100px",
    //                       marginLeft: "30px",
    //                     }}
    //                   >
    //                     <div
    //                       className="mesurement-note"
    //                       style={{ border: "1px solid #333", height: "70px" }}
    //                     >
    //                       <h2
    //                         style={{
    //                           fontSize: "10px",
    //                           paddingBottom: "0.25rem",
    //                           backgroundColor: "white",
    //                           color: "#000",
    //                           wordSpacing: "0",
    //                           borderBottom: "1px solid #333",
    //                           textAlign: "center",
    //                           margin: 0
    //                         }}
    //                       >
    //                         Styling Notes:
    //                       </h2>
    //                       <p
    //                         style={{
    //                           fontSize: "10px",
    //                           paddingLeft: "0",
    //                           paddingTop: "0.25rem",
    //                           textAlign: "center",
    //                         }}
    //                       >
    //                         {orderItem.styles.note}
    //                       </p>
    //                     </div>
    //                   </div>
    //                 </div>
    //               </div>
    //             </div>
    //           </>
    //         );
    //       })}
          
    //       {singleOrderArray.map((reference , j) => {
    //         if(reference.item_name == "suit" &&
    //         reference.item_code.split(" ")[0] == "jacket" &&
    //         reference['styles']["jacket"]['referance_image']!== undefined){
    //           return (
    //             <div key={j} style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
    //               <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name.charAt(0)}(${reference.item_code})`}</p>
    //               <img src={PicBaseUrl + reference['styles']["jacket"]['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/> 
    //             </div>
    //           )
    //         } else if(reference.item_name == "suit" &&
    //         reference.item_code.split(" ")[0] == "pant" &&
    //         reference['styles']["pant"]['referance_image']!== undefined){
    //           return (
    //             <div key={j} style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
    //               <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name}(${reference.item_code})`}</p>
    //               <img src={PicBaseUrl + reference['styles']["pant"]['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto',}}/>
    //             </div>
    //           )
    //         } else if(reference['styles']['referance_image'] !== undefined) {
    //            return (
    //             <div key={j} style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
    //               <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name}(${reference.item_code})`}</p>
    //               <img src={PicBaseUrl + reference['styles']['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/>
    //             </div>
    //           )
    //         }
    //       })}

    //       { thisOrder['customer_id']['image'] !== undefined &&
    //       <div>
    //         <p style={{textAlign:"center", textTransform:'capitalize'}}>Customer Image</p>
    //         <img src={PicBaseUrl + thisOrder['customer_id']['image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/>
    //       </div>}
    //     </div>
    //   </>
    // );

    const orderItemsArrayPDFString = JSON.stringify(orderItemsArrayPDF)

    const singleOrderArrayString = JSON.stringify(singleOrderArray)

    const productFeaturesObjectString = JSON.stringify(productFeaturesObject)

    const draftMeasurementsObjString = JSON.stringify(draftMeasurementsObj)

    const pdfString = await axiosInstance.post('groupOrders/createPdf', {
      token: user.data.token,
      productFeaturesObject: productFeaturesObjectString,
      orderItemsArray: orderItemsArrayPDFString, 
      singleOrderArray: singleOrderArrayString,
      draftMeasurementsObj: draftMeasurementsObjString,
      order: JSON.stringify(thisOrder),
      retailer: JSON.stringify(res1.data.data[0])
    })

    if(pdfString.data.status == true){
      setGeneratePDFButton(false)
      // const sendMail = await axiosInstance.post('groupOrders/sendMail', {
      //   token: user.data.token,
      //   order: thisOrder['orderId']
      // })
      
      navigate("/");
      
    }
  };

  const handleOpenPdf = async(data) => {
    const stringPdf = data.split(".pdf")[0]
    
    const url = PicBaseUrl4 + stringPdf;
    window.open(url);
  }
  // const exportPDF = async (thisOrder, draftMeasurementsObj) => {

  //   let orderItemsArrayPDF = [];

  //   let justAnArray = [];



  //   // const res = await axiosInstance.post(
  //   //   "/customerOrders/fetchOrderByID/" + order,
  //   //   { token: user.data.token }
  //   // );
    


  //   const res1 = await axiosInstance.post('/retailer/fetch', {
  //     token: user.data.token,
  //     id: thisOrder['retailer_id']
  //   })


  //   var retailerObject = res1.data.data[0]


  //   let orderItemsArray = [];
  //   for (let m of thisOrder["order_items"]) {
  //     if (m.item_name == "suit") {
  //       for (let l of Object.keys(thisOrder.Suitmeasurements)) {
  //         for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //           let itemsObject = {
  //             item_name: m["item_name"],
  //             item_code: l + " " + n,
  //             quantity: m["quantity"],
  //             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //           };
  //           orderItemsArray.push(itemsObject);
  //         }
  //       }
  //     } else {
  //       for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //         let itemsObject = {
  //           item_name: m["item_name"],
  //           item_code: m["item_name"] + " " + n,
  //           quantity: m["quantity"],
  //           styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //         };
  //         orderItemsArray.push(itemsObject);
  //       }
  //     }
  //     // for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //     //   let itemsObject = {
  //     //     item_name: m["item_name"],
  //     //     item_code: m["item_name"] + " " + n,
  //     //     quantity: m["quantity"],
  //     //     styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //     //   };
  //     //   orderItemsArray.push(itemsObject);
  //     // }
  //   }

  //   let j = 1;

  //   for (let m of thisOrder["order_items"]) {
  //     if (m.item_name == "suit") {
  //       for (let l of Object.keys(thisOrder.Suitmeasurements)) {
  //         for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //           let itemsObject = {
  //             item_name: m["item_name"],
  //             item_code: l + " " + n,
  //             quantity: m["quantity"],
  //             repeatOrder: thisOrder["repeatOrder"],
  //             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //           };
            
            

  //           if (j % 5 == 0 || orderItemsArray.length == j) {
  //             justAnArray.push(itemsObject);
  //             orderItemsArrayPDF.push(justAnArray);
  //             justAnArray = [];
  //           } else {
  //             justAnArray.push(itemsObject);
  //           }

  //           j = j + 1;
  //         }
  //       }
  //     } else {
  //       for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //         let itemsObject = {
  //           item_name: m["item_name"],
  //           item_code: m["item_name"] + " " + n,
  //           quantity: m["quantity"],
  //           repeatOrder: thisOrder["repeatOrder"],
  //           styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //         };
  //         if (j % 5 == 0 || orderItemsArray.length == j) {
  //           justAnArray.push(itemsObject);
  //           orderItemsArrayPDF.push(justAnArray);
  //           justAnArray = [];
  //         } else {
  //           justAnArray.push(itemsObject);
  //         }

  //         j = j + 1;
  //       }
  //     }
  //     // for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //     //   let itemsObject = {
  //     //     item_name: m["item_name"],
  //     //     item_code: m["item_name"] + " " + n,
  //     //     quantity: m["quantity"],
  //     //     repeatOrder: res.data.data[0]["repeatOrder"],
  //     //     styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //     //   };

  //     //   if (j % 5 == 0 || orderItemsArray.length == j) {
  //     //     justAnArray.push(itemsObject);
  //     //     orderItemsArrayPDF.push(orderItemsArray);
  //     //     justAnArray = [];
  //     //   } else {
  //     //     justAnArray.push(itemsObject);
  //     //   }

  //     //   j = j + 1;
  //     // }
  //   }

  //   let singleOrderArray = [];

  //   for (let m of thisOrder["order_items"]) {
  //     if (m.item_name == "suit") {
  //       for (let l of Object.keys(thisOrder.Suitmeasurements)) {
  //         for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //           let itemsObject = {
  //             item_name: m["item_name"],
  //             item_code: l + " " + n,
  //             quantity: m["quantity"],
  //             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //             measurementsObject: thisOrder.Suitmeasurements[l],
  //             manualSize:
  //             thisOrder.manualSize == null ? (
  //                 <></>
  //               ) : (
  //                 thisOrder.manualSize[m["item_name"]]
  //               ),
  //           };
  //           singleOrderArray.push(itemsObject);
  //         }
  //       }
  //     } else {
  //       for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
  //         let itemsObject = {
  //           item_name: m["item_name"],
  //           item_code: m["item_name"] + " " + n,
  //           quantity: m["quantity"],
  //           styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
  //           measurementsObject: thisOrder.measurements[m["item_name"]],
  //           manualSize:
  //           thisOrder.manualSize == null ? (
  //               <></>
  //             ) : (
  //               thisOrder.manualSize[m["item_name"]]
  //             ),
  //         };
  //         singleOrderArray.push(itemsObject);
  //       }
  //     }
  //   }

  //   let doc = new jsPDF("l", "px", [595, 842]); 
  //   // doc.addFileToVFS("", AmiriRegular);
  //   // doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  
  //   // doc.setFont("Amiri"); // set font
  //   // doc.setFontSize(10);
    
  //   let htmlElement = (
  //     <>
  //       <div className="view-order-contents">
  //         {orderItemsArrayPDF.map((sub, index) => {
  //           // let marginBottomVar = 90- index * 20 + "px";

  //           if (index == orderItemsArrayPDF.length - 1) {
  //             var variableLength = 5 - sub.length;
  //           }
  //           var dummyElements = [];
  //           for (let i = 1; i <= variableLength; i++) {
  //             dummyElements.push(i);
  //           }
  //           return (
  //             <div
  //               key={index}
  //               className="view-order-top-contents"
  //               style={{ paddingTop: "0", height:"600px" }}
  //             >
  //               <div className="top-header"style={{border: '1px solid black', padding: '2px'}}>
                 
  //               <div className="top-list-data" style={{display:'flex', alignItems:'center', justifyContent:'space-between', columnGap: '20px', rowGap:'20px'}}>
                  
  //                 <div className="info">
  //                   <p style={{fontSize:'9px'}}>Customer Name : {thisOrder.customerName}</p>
  //                   <p style={{fontSize:'9px'}}>Order Date : {thisOrder.OrderDate}</p>
  //                   <p style={{fontSize:'9px'}}>Repeat Order : {thisOrder.repeatOrder == true ? "Yes" : "No"}</p>
  //                   {thisOrder['order_status'] == "Modified" ? <p style={{fontSize:'9px', color:"green"}}>Modified</p>: <></>}
  //                 </div>

  //                 <div className="order-id">
  //                 <p style={{fontSize:'10px', transform:'translateX(-50px)'}}>{thisOrder.orderId}</p>
  //                </div> 
                 
  //                 <div className="info" style={{display: 'flex', alignItems:'center', columnGap: '10px'}}>
  //                   <img src={PicBaseUrl + retailerObject['retailer_logo']} style={{width: '50px', height: '50px'}}/>
  //                 </div>

  //                </div>
  //                 </div>
  //               <div
  //                 className="product-details"
  //                 style={{
  //                   border: "0",
  //                   paddingTop: "0",
  //                   paddingRight: "0",
  //                   paddingLeft: "0",
  //                 }}
  //               >
  //                 <div className="details-table" style={{ border: "0" }}>
  //                   <div className="tableData">
  //                     <table
  //                       key={index}
  //                       style={{
  //                         borderCollapse: "collapse",
  //                         borderSpacing: "0",
  //                         pageBreakAfter: "always",
  //                         height: "100%",
  //                       }}
  //                     >
  //                       <tbody>
  //                         {sub.map((singles, i) => {
  //                           return (
  //                             <tr key={i}>
  //                               <td
  //                                 style={{
  //                                   borderLeft: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   textAlign: "center",
  //                                   backgroundColor: "white",
  //                                   padding: "0",
  //                                 }}
  //                               >
  //                                 <span
  //                                   style={{
  //                                     fontSize: "10px",
  //                                     lineHeight: "0",
  //                                   }}
  //                                 >
  //                                   {singles.item_name.charAt(0).toUpperCase() + singles.item_name.slice(1)}
  //                                 </span>
  //                               </td>
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   textAlign: "center",
  //                                   backgroundColor: "white",
  //                                   padding: "0",
  //                                 }}
  //                               >
  //                                 <span
  //                                   style={{
  //                                     fontSize: "10px",
  //                                     lineHeight: "0",
  //                                   }}
  //                                 >
  //                                   {singles.item_code.charAt(0).toUpperCase() + singles.item_code.slice(1)}
  //                                 </span>
  //                               </td>
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   textAlign: "center",
  //                                   backgroundColor: "white",
  //                                   padding: "0",
  //                                 }}
  //                               >
  //                                 <span
  //                                   style={{
  //                                     fontSize: "10px",
  //                                     lineHeight: "0",
  //                                   }}
  //                                 >{`(${singles.styles.fabric_code})`}</span>
  //                               </td>
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   textAlign: "center",
  //                                   backgroundColor: "white",
  //                                   padding: "5px",
  //                                 }}
  //                               >
  //                                 <img
  //                                   src={mainQR}
  //                                   className="img-fit"
  //                                   width="60"
  //                                   height="60"
  //                                   // style={{ width: "40%" }}
  //                                 />
  //                               </td>
  //                             </tr>
  //                           );
  //                         })}

  //                         {dummyElements.length > 0 ? (
  //                           dummyElements.map((element, i) => {
  //                             return (
  //                               <tr key={i}>
  //                                 <td
  //                                   style={{
  //                                     borderLeft: "1px solid #ffffff",
  //                                     borderRight: "1px solid #ffffff",
  //                                     borderBottom: "1px solid #ffffff",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     padding: "0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "10px",
  //                                       lineHeight: "0",
  //                                     }}
  //                                   ></span>
  //                                 </td>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #ffffff",
  //                                     borderBottom: "1px solid #ffffff",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     padding: "0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "10px",
  //                                       lineHeight: "0",
  //                                     }}
  //                                   ></span>
  //                                 </td>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #ffffff",
  //                                     borderBottom: "1px solid #ffffff",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     padding: "0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "10px",
  //                                       lineHeight: "0",
  //                                     }}
  //                                   ></span>
  //                                 </td>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #ffffff",
  //                                     borderBottom: "1px solid #ffffff",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     padding: "5px",
  //                                   }}
  //                                 >
  //                                   {" "}
  //                                   <span
  //                                     style={{
  //                                       display: "block",
  //                                       minHeight: "75px",
  //                                     }}
  //                                   ></span>
  //                                 </td>
  //                               </tr>
  //                             );
  //                           })
  //                         ) : (
  //                           <></>
  //                         )}
  //                       </tbody>
  //                     </table>
  //                   </div>
  //                 </div>
  //                 <div style={{display: "flex", flexDirection: "row", width: "100%", border: "solid 1px", padding: "5px", justifyContent: "center"}}>
  //                 {
  //                   thisOrder['order_items'].map((items) => {
  //                     return (
  //                       <>
  //                         <span key={items['item_name']} style ={{textTransform: "capitalize", fontSize: "9px"}}>{items['quantity'] + " " + items['item_name']}</span>
  //                       </>
  //                     )
  //                   })
  //                 }
  //                </div>
  //               </div>
  //             </div>
  //           );
  //         })}
  //         {singleOrderArray.map((orderItem, i) => {
            
  //           return (
  //             <>
  //               <div
  //                 key={i}
  //                 className="view-order-top-contents"
  //                 style={{ height: "590px", overflow:"hidden", marginTop: "0px", marginBottom:"0px"}}
  //               >
  //                 {/* <h3
  //                   style={{
  //                     paddingBottom: "5px",
  //                     textAlign: "center",
  //                     fontSize: "10px",
  //                     textTransform: "uppercase",
  //                     width: "100%",
  //                     margin: "10px 0 0 0",
  //                   }}
  //                 >
  //                   Siam Suits Supply
  //                 </h3> */}
  //                 <div
  //                   className="order-header"
  //                   style={{ paddingLeft: "0px", paddingBottom: "0" }}
  //                 >
  //                   <div className="person-details" style={{ padding: "0px" }}>
  //                     <div
  //                       className="details-group"
  //                       style={{ border: "0px", paddingLeft: "0px" }}
  //                     >
  //                       <ul style={{ paddingLeft: "0px" }}>
  //                         <li style={{ border: "0px", display: "flex" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Name:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               {thisOrder.customerName}
  //                             </span>{" "}
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Order Date:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               {thisOrder.orderDate}
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             QTY:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               1 OF 2
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Old Order:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               No Oreders
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li
  //                           style={{
  //                             border: "0",
  //                             textAlign: "right",
  //                             justifyContent: "end",
  //                             marginTop: "-10px",
  //                           }}
  //                         >
  //                           <span
  //                             style={{
  //                               fontSize: "10px",
  //                               lineHeight: "0",
  //                               textAlign: "right",
  //                             }}
  //                           >
  //                             Male(malethai)
  //                           </span>
  //                         </li>
  //                       </ul>
  //                     </div>
  //                     <div
  //                       className="person-identity"
  //                       style={{ border: "0px" }}
  //                     >
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           lineHeight: "0",
  //                           border: "1px solid #333",
  //                           padding: "20px 35px",
  //                           margin: 0,
  //                           display: "inline-block",
  //                         }}
  //                       >
  //                         <u>{thisOrder.orderId}</u>
  //                       </h2>
  //                       <p
  //                         style={{
  //                           fontSize: "10px",
  //                           lineHeight: "0",
  //                           textTransform: "uppercase",
  //                           textAlign: "center",
  //                         }}
  //                       >
  //                         <strong>{orderItem.item_code}</strong>
  //                       </p>
  //                     </div>
  //                     <div
  //                       className="person-upi-code"
  //                       style={{
  //                         border: "0px",
  //                         textAlign: "center",
  //                         justifyContent: "center",
  //                         alignItems: "flex-start",
  //                       }}
  //                     >
  //                       <img
  //                         src={mainQR}
  //                         className="img-fit"
  //                         style={{ width: "30%" }}
  //                       />
  //                     </div>
  //                   </div>
  //                 </div>
  //                 <div
  //                   className="mesurement-info"
  //                   style={{
  //                     border: "0",
  //                     paddingTop: "0",
  //                     paddingRight: "0",
  //                     paddingLeft: "0",
  //                     height: "auto",
  //                     marginBottom:"-10px",
  //                   }}
  //                 >
  //                   <div className="info-col-5">
  //                     <div className="info-table" style={{ border: "0" }}>
  //                       <table
  //                         style={{
  //                           border: "1px solid #333",
  //                           borderTop: "0",
  //                           borderRight: "0",
  //                           borderBottom: "0",
  //                           borderCollapse: "collapse",
  //                           width: "100%",
  //                           height: "100%"
  //                         }}
  //                       >
  //                         <thead>
  //                           <tr style={{ padding: "0" }}>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 padding: "3px 0",
  //                                 margin:"0",
  //                                 lineHeight: "0px",
  //                               }}
  //                             ></th>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 padding: "3px 0",
  //                                 verticalAlign: "middle",
  //                                 margin:"0",
  //                                 lineHeight: "0px",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   display: "block",
  //                                   padding: "0",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
  //                                   borderBottom: "1px solid #333",
                                   
  //                                 }}
  //                               >
  //                                 Skin
  //                               </span>
  //                               <p
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   padding: "0",
  //                                   lineHeight: "0px",
  //                                   display: "inline-block",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
                                  
  //                                 }}
  //                               >
  //                                 thai
  //                               </p>
  //                             </th>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 padding: "3px 0",
  //                                 verticalAlign: "middle",
  //                                 margin:"0",
  //                                 lineHeight: "0px",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   display: "block",
  //                                   padding: "0",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
  //                                   borderBottom: "1px solid #333",
  //                                 }}
  //                               >
  //                                 Fit
  //                               </span>
  //                               <p
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   padding: "0",
  //                                   lineHeight: "0px",
  //                                   display: "inline-block",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
  //                                 }}
  //                               >
  //                                 thai
  //                               </p>
  //                             </th>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 padding: "3px 0",
  //                                 verticalAlign: "middle",
  //                                 margin:"0",
  //                                 lineHeight: "0px",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   display: "block",
  //                                   padding: "0",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
  //                                   borderBottom: "1px solid #333",
  //                                 }}
  //                               >
  //                                 TTL
  //                               </span>
  //                               <p
  //                                 style={{
  //                                   fontSize: "8px",
  //                                   padding: "0",
  //                                   lineHeight: "0px",
  //                                   display: "inline-block",
  //                                   margin:"0",
  //                                   lineHeight: "10px",
  //                                 }}
  //                               >
  //                                 thai
  //                               </p>
  //                             </th>
  //                           </tr>
  //                         </thead>
  //                         <tbody>
  //                           {Object.keys(
  //                             orderItem.measurementsObject.measurements
  //                           ).map((measurement, i) => {
  //                             return (
  //                               <tr key={i}>
  //                                 <th
  //                                   style={{
  //                                     borderRight: "1px solid #333",
  //                                     borderLeft: "1px solid #333",
  //                                     borderBottom: "1px solid #333",
  //                                     textAlign: "left",
  //                                     backgroundColor: "white",
  //                                     paddingLeft: "0.25rem",
  //                                     lineHeight:"0",
  //                                     margin: "0",
  //                                     padding:"0"
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "8px",
  //                                       lineHeight: "0",
  //                                       padding:"0",
  //                                       paddingLeft: "0.25rem",
  //                                       margin:"0",
  //                                       textTransform:'capitalize'
  //                                     }}
  //                                   >
  //                                     {measurement}
  //                                     {" "}
  //                                     <p className="font-face-gm" style={{fontFamily: 'Noto Sans Thai'}}>{measurement}</p>
                                      
  //                                   </span>
  //                                 </th>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #333",
  //                                     borderBottom: "1px solid #333",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     paddingLeft: "0.25rem",
  //                                     margin: "0",
  //                                     padding: "2px 0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "7px",
  //                                       lineHeight: "0",
  //                                       margin: "0",
  //                                       padding:"0"
  //                                     }}
  //                                   >
  //                                     {
  //                                       orderItem.measurementsObject
  //                                         .measurements[measurement].value
  //                                     }
  //                                   </span>
  //                                 </td>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #333",
  //                                     borderBottom: "1px solid #333",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     paddingLeft: "0.25rem",
  //                                     margin: "0",
  //                                     padding: "2px 0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "7px",
  //                                       lineHeight: "0",
  //                                       margin: "0",
  //                                       padding:"0",
  //                                     }}
  //                                   >
  //                                     {
  //                                       orderItem.measurementsObject
  //                                         .measurements[measurement]
  //                                         .adjustment_value
  //                                     }
  //                                   </span>
  //                                 </td>
  //                                 <td
  //                                   style={{
  //                                     borderRight: "1px solid #333",
  //                                     borderBottom: "1px solid #333",
  //                                     textAlign: "center",
  //                                     backgroundColor: "white",
  //                                     paddingLeft: "0.25rem",
  //                                     margin: "0",
  //                                     padding: "2px 0",
  //                                   }}
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontSize: "7px",
  //                                       lineHeight: "0",
  //                                       margin: "0",
  //                                       padding:"0"
  //                                     }}
  //                                   >
  //                                     {
  //                                       orderItem.measurementsObject
  //                                         .measurements[measurement].total_value
  //                                     }
  //                                   </span>
  //                                   <strong>
  //                                       {
  //                                       orderItem['item_name'] !== 'suit'
  //                                       ?
  //                                       draftMeasurementsObj && draftMeasurementsObj[orderItem['item_name']] &&
  //                                         orderItem.measurementsObject.measurements[measurement].total_value !== draftMeasurementsObj[orderItem['item_name']]['measurements'][measurement]['total_value']
  //                                         ?
  //                                           "*"
  //                                         :
  //                                           ""
  //                                       :  
  //                                       draftMeasurementsObj && draftMeasurementsObj[orderItem['item_code'].split(" ")[0]] &&
  //                                       orderItem.measurementsObject.measurements[measurement].total_value !== draftMeasurementsObj[orderItem['item_code'].split(" ")[0]]['measurements'][measurement]['total_value']
  //                                       ?
  //                                         "*"
  //                                       :
  //                                         ""  
  //                                       }
  //                                     </strong>
  //                                 </td>
  //                               </tr>
  //                             );
  //                           })}
  //                         </tbody>
  //                       </table>
  //                     </div>
  //                   </div>
  //                   <div className="info-col-7">
  //                     <div className="manual-info">
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           padding: "0.45rem",
  //                           color: "#000",
  //                           background: "#fff",
  //                           margin: 0
  //                         }}
  //                       >
  //                         Manual Size:
  //                       </h2>
  //                       <div className="img-box" style={{ height: "200px" }}>

  //                        { orderItem.item_name == 'suit'
  //                        ?
  //                        <img
  //                        src={orderItem.manualSize && orderItem.manualSize[orderItem['item_code'].split(" ")[0]] && orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
  //                          ?
  //                          PicBaseUrl + orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
  //                          :
  //                          PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
  //                       }
  //                       className="img-fit"
  //                       style={{ width: "440px", height: "200px" }}
  //                       />
  //                       :
  //                       <img
  //                       src={orderItem.manualSize && orderItem.manualSize.imagePic
  //                         ?
  //                         PicBaseUrl + orderItem.manualSize.imagePic
  //                         :
  //                         PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
  //                       }
  //                       className="img-fit"
  //                       style={{ width: "440px", height: "200px" }}
  //                     />
  //                       }
                       
  //                       </div>
  //                     </div>
  //                     <div
  //                       className="mesurement-note"
  //                       style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
  //                     >
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           paddingBottom: "0px",
  //                           backgroundColor: "white",
  //                           color: "#000",
  //                           wordSpacing: "0",
  //                           borderRight: "1px solid #333",
  //                           textAlign: "center",
  //                           width:'160px',
  //                           margin: 0,
  //                           lineHeight:"0",
  //                         }}
  //                       >
  //                         <strong>Measurement Note</strong>
  //                       </h2>
  //                       <p
  //                         style={{
  //                           fontSize: "10px",
  //                           paddingLeft: "0",
  //                           paddingTop: "0px",
  //                           textAlign: "center",
  //                           margin: 0,
  //                           lineHeight:"5px",
  //                           transform:"translateY(5px)"
                            
  //                         }}
  //                       >
  //                         {orderItem.measurementsObject.notes}
  //                       </p>
  //                     </div>
  //                     {
  //                       orderItem['measurementsObject']['shoulder_type']
  //                       ?
  //                       <div
  //                         className="mesurement-note"
  //                         style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px', overflow: "hidden" }}
  //                       >
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           paddingBottom: "10px",
  //                           backgroundColor: "white",
  //                           color: "#000",
  //                           wordSpacing: "0",
  //                           borderRight: "1px solid #333",
  //                           textAlign: "center",
  //                           width:'160px',
  //                           margin: 0
  //                         }}
  //                       >
  //                         <strong>Shoulder type</strong>
  //                       </h2>
  //                       <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['shoulder_type'][0].toUpperCase() + orderItem['measurementsObject']['shoulder_type'].slice(1)}</p>
  //                       <img style={{padding:'8px', height:"40px", width:'40px', filter: "drop-shadow(-5px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/jacket/" + orderItem['measurementsObject']['shoulder_type'] + ".png"} alt="" />
  //                     </div>
  //                     :
  //                     orderItem['measurementsObject']['pant_type']
  //                     ?

  //                     <div
  //                       className="mesurement-note"
  //                       style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
  //                     >
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           paddingBottom: "10px",
  //                           backgroundColor: "white",
  //                           color: "#000",
  //                           wordSpacing: "0",
  //                           borderRight: "1px solid #333",
  //                           textAlign: "center",
  //                           width:'160px',
  //                           margin: 0
  //                         }}
  //                       >
  //                         <strong>Pants type</strong>
  //                       </h2>
  //                       <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['pant_type'][0].toUpperCase() + orderItem['measurementsObject']['pant_type'].slice(1)}</p>
  //                       <img style={{padding:'8px', height:"40px", width:'40px', filter: "drop-shadow(0px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/pants/" + orderItem['measurementsObject']['pant_type'] + ".png"} alt="" />
  //                     </div>

  //                     :
  //                     <></>
                      
  //                     }
                     
  //                   </div>
  //                 </div>
  //                 <div
  //                   className="product-final-views"
  //                   style={{
  //                     padding: "0",
  //                     border: "0",
  //                     lineHeight: "0",
  //                     margin:"0",
  //                   }}
  //                 >
  //                   <div
  //                     className="product-views"
  //                     style={{
  //                       padding: "0",
  //                       border: "1px solid #333",
  //                       lineHeight: "0",
  //                       margin:"0",
                       
  //                     }}
  //                   >
  //                     <div className="info-col-12">
  //                       <div
  //                         className="view-lists"
  //                         style={{
  //                           width: "100%",
  //                           padding: "5px 0 0 0",
  //                           border: "0",
  //                           lineHeight: "0",
  //                           margin:"0",
  //                         }}
  //                       >
  //                         <table
  //                           style={{
  //                             border: "0",
  //                             borderCollapse: "collapse",
  //                             padding: "0",
  //                             width: "100%",
  //                           }}
  //                         >
  //                           <thead>
  //                               <tr style={{ padding: "0" }}>
  //                                 {orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] == "jacket"
  //                                   ? 
  //                                   productFeaturesObject['jacket'].map((proFea) =>(
  //                                     Object.keys(
  //                                       orderItem["styles"]["jacket"]["style"]
  //                                     ).map((data, i) => {
  //                                       if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'false' && proFea == data){
  //                                         return (
  //                                           <th
  //                                             key={i}
  //                                             style={{
  //                                               border: "0",
  //                                               backgroundColor: "white",
  //                                               color: "#000",
  //                                               textAlign: "center",
  //                                               textTransform: "capitalize",
  //                                               margin:"0",
  //                                               padding:"0",
  //                                             }}
  //                                           >
  //                                             <span
  //                                               style={{
  //                                                 fontSize: "8px",
  //                                                 lineHeight: "0px",
  //                                                 margin:"0",
  //                                               padding:"0",
  //                                               }}
  //                                             >
  //                                               {data}
  //                                             </span>
  //                                           </th>
  //                                         );
  //                                       }
                                      
  //                                     })
  //                                   ))
  //                                   : 
  //                                   orderItem.item_name == "suit" &&
  //                                     orderItem.item_code.split(" ")[0] == "pant"
  //                                     ?                                     
  //                                   productFeaturesObject['pant'].map((proFea) =>(
  //                                     Object.keys(
  //                                       orderItem["styles"]["pant"]["style"]
  //                                     ).map((data, i) => {
  //                                       if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'false'  && proFea == data){
  //                                         return (
  //                                           <th
  //                                             key={i}
  //                                             style={{
  //                                               border: "0",
  //                                               backgroundColor: "white",
  //                                               color: "#000",
  //                                               textAlign: "center",
  //                                               textTransform: "capitalize",
  //                                               margin:"0",
  //                                             padding:"0",
  //                                             }}
  //                                           >
  //                                             <span
  //                                               style={{
  //                                                 fontSize: "8px",
  //                                                 lineHeight: "10px",
  //                                                 margin:"0",
  //                                             padding:"0",
  //                                               }}
  //                                             >
  //                                               {data}
  //                                             </span>
  //                                           </th>
  //                                         );
  //                                       }
                                        
  //                                     })
  //                                     ))
  //                                     : productFeaturesObject[orderItem['item_name']].map((proFea) =>(
  //                                       Object.keys(orderItem.styles.style).map(
  //                                         (data, i) => {
  //                                           if(orderItem['styles']['style'][data]['additional'] == 'false' && proFea == data){
  //                                             return (
  //                                               <th
  //                                                 key={i}
  //                                                 style={{
  //                                                   border: "0",
  //                                                   backgroundColor: "white",
  //                                                   color: "#000",
  //                                                   textAlign: "center",
  //                                                   textTransform: "capitalize",
  //                                                   margin:"0",
  //                                                   padding:"0",
  //                                                 }}
  //                                               >
  //                                                 <span
  //                                                   style={{
  //                                                     fontSize: "8px",
  //                                                     lineHeight: "10px",
  //                                                     margin:"0",
  //                                                     padding:"0",
  //                                                   }}
  //                                                 >
  //                                                   {data}
  //                                                 </span>
  //                                               </th>
  //                                             );
  //                                           }
                                            
  //                                         }
  //                                       )
  //                                     ))
  //                                     }
  //                               </tr>
  //                           </thead>
  //                           <tbody>
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket"

                                
  //                               ? 
  //                               productFeaturesObject['jacket'].map((proFea) =>(
  //                               Object.keys(
  //                                 orderItem["styles"]["jacket"]["style"]
  //                               ).map((data, i) => {
  //                                 if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'false' && proFea == data){
  //                                   return (
  //                                     <td
  //                                       key={i}
  //                                       align="center"
  //                                       style={{
  //                                         backgroundColor: "white",
  //                                         color: "#000",
  //                                         textAlign: "center",
  //                                         padding: "0",
  //                                         margin:"0",
                                          
  //                                       }}
  //                                     >
  //                                       <div
  //                                         className="img-box"
  //                                         style={{
  //                                           lineHeight: "0",
  //                                           padding: "0",
  //                                           margin:"0",
  //                                           padding:"0",
  //                                         }}
  //                                       >
  //                                         <img
  //                                           src={
  //                                             PicBaseUrl +
  //                                             orderItem["styles"]["jacket"]["style"][data][
  //                                             "image"
  //                                             ]
  //                                           }
  //                                           className="img-fit"
  //                                           style={{
  //                                             width: "40px",
  //                                             height: "40px",
  //                                             margin: "5px 0",
  //                                             padding: "0",
  //                                             transform:"translateY(5px)"
  //                                           }}
  //                                         />
  //                                       </div>
  //                                       <p
  //                                         style={{
  //                                           fontSize: "8px",
  //                                           lineHeight: "0",
  //                                           textAlign: "center",
  //                                         }}
  //                                       >
  //                                         {
  //                                           orderItem["styles"]["jacket"]["style"][data][
  //                                           "value"
  //                                           ]
  //                                         }
  //                                       </p>
  //                                     </td>
  //                                   );
  //                                 }
                                  
  //                               })
  //                              ))
  //                               : orderItem.item_name == "suit" &&
  //                                 orderItem.item_code.split(" ")[0] == "pant"
  //                                 ? 
  //                                 productFeaturesObject['pant'].map((proFea) =>(
  //                                 Object.keys(orderItem["styles"]["pant"]["style"]).map(
  //                                   (data, i) => {
  //                                     if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'false' && proFea == data){
  //                                       return (
  //                                         <td
  //                                           key={i}
  //                                           align="center"
  //                                           style={{
  //                                             backgroundColor: "white",
  //                                             color: "#000",
  //                                             textAlign: "center",
  //                                             padding: "0",
  //                                           }}
  //                                         >
  //                                           <div
  //                                             className="img-box"
  //                                             style={{
  //                                               lineHeight: "0",
  //                                               padding: "0",
  //                                             }}
  //                                           >
  //                                             <img
  //                                               src={
  //                                                 PicBaseUrl +
  //                                                 orderItem["styles"]["pant"]["style"][data][
  //                                                 "image"
  //                                                 ]
  //                                               }
  //                                               className="img-fit"
  //                                               style={{
  //                                                 width: "40px",
  //                                             height: "40px",
  //                                             margin: "5px 0",
  //                                             padding: "0",
  //                                             transform:"translateY(5px)"
  //                                               }}
  //                                             />
  //                                           </div>
  //                                           <p
  //                                             style={{
  //                                               fontSize: "8px",
  //                                               lineHeight: "0",
  //                                               textAlign: "center",
  //                                             }}
  //                                           >
  //                                             {
  //                                               orderItem["styles"]["pant"]["style"][data][
  //                                               "value"
  //                                               ]
  //                                             }
  //                                           </p>
  //                                         </td>
  //                                       );
  //                                     }
                                      
  //                                   }
  //                                 )
  //                                 ))
  //                                 : 
  //                                 productFeaturesObject[orderItem['item_name']].map((proFea) =>(
  //                                 Object.keys(orderItem.styles.style).map(
  //                                   (data, i) => {
  //                                     if(orderItem['styles']['style'][data]['additional'] == 'false'&& proFea == data){
  //                                       return (
  //                                         <td
  //                                           key={i}
  //                                           align="center"
  //                                           style={{
  //                                             backgroundColor: "white",
  //                                             color: "#000",
  //                                             textAlign: "center",
  //                                             padding: "0",
  //                                           }}
  //                                         >
  //                                           <div
  //                                             className="img-box"
  //                                             style={{
  //                                               lineHeight: "0",
  //                                               padding: "0",
  //                                             }}
  //                                           >
  //                                             <img
  //                                               src={
  //                                                 PicBaseUrl +
  //                                                 orderItem.styles.style[data][
  //                                                 "image"
  //                                                 ]
  //                                               }
  //                                               className="img-fit"
  //                                               style={{
  //                                                 width: "40px",
  //                                             height: "40px",
  //                                             margin: "5px 0",
  //                                             padding: "0",
  //                                             transform:"translateY(5px)"
  //                                               }}
  //                                             />
  //                                           </div>
  //                                           <p
  //                                             style={{
  //                                               fontSize: "8px",
  //                                               lineHeight: "0",
  //                                               textAlign: "center",
  //                                             }}
  //                                           >
  //                                             {
  //                                               orderItem.styles.style[data][
  //                                               "value"
  //                                               ]
  //                                             }
  //                                           </p>
  //                                         </td>
  //                                       );
  //                                     }
                                      
  //                                   }
  //                                 )
  //                                 ))
  //                                 }
  //                           </tbody>
  //                         </table>
  //                       </div>
  //                     </div>
  //                   </div>
  //                 </div>
  //               </div>
  //               <div className="product-styling" style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
  //                 {/* <h3
  //                   style={{
  //                     paddingBottom: "5px",
  //                     textAlign: "center",
  //                     fontSize: "10px",
  //                     textTransform: "uppercase",
  //                     width: "100%",
  //                     margin: 0
  //                   }}
  //                 >
  //                   Siam Suits Supply
  //                 </h3> */}
  //                 <div
  //                   className="order-header"
  //                   style={{ paddingLeft: "0px", paddingBottom: "0" }}
  //                 >
  //                   <div className="person-details" style={{ padding: "0px" }}>
  //                     <div
  //                       className="details-group"
  //                       style={{ border: "0px", paddingLeft: "0px" }}
  //                     >
  //                       <ul style={{ paddingLeft: "0px" }}>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Name:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               {thisOrder.customerName}
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Order Date:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               {thisOrder.orderDate}
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             QTY:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               1 OF 2
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li style={{ border: "0px" }}>
  //                           <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
  //                             Old Order:{" "}
  //                             <span
  //                               style={{
  //                                 fontSize: "10px",
  //                                 lineHeight: "0",
  //                                 textTransform: "capitalize",
  //                                 wordSpacing: "-2px",
  //                                 paddingLeft: "3px",
  //                                 letterSpacing: "0px",
  //                               }}
  //                             >
  //                               No Orders
  //                             </span>
  //                           </h4>
  //                         </li>
  //                         <li
  //                           style={{
  //                             border: "0",
  //                             textAlign: "right",
  //                             justifyContent: "end",
  //                             marginTop: "10px",
  //                           }}
  //                         >
  //                           <span
  //                             style={{
  //                               fontSize: "10px",
  //                               lineHeight: "0",
  //                               textAlign: "right",
  //                             }}
  //                           >
  //                             Male(malethai)
  //                           </span>
  //                         </li>
  //                       </ul>
  //                     </div>
  //                     <div
  //                       className="person-identity"
  //                       style={{ border: "0px" }}
  //                     >
  //                       <h2
  //                         style={{
  //                           fontSize: "10px",
  //                           lineHeight: "0",
  //                           border: "1px solid #333",
  //                           padding: "20px 35px",
  //                           display: "inline-block",
  //                           margin: 0
  //                         }}
  //                       >
  //                         <u>{thisOrder.orderId}</u>
  //                       </h2>
  //                       <p
  //                         style={{
  //                           fontSize: "10px",
  //                           lineHeight: "0",
  //                           textTransform: "uppercase",
  //                           textAlign: "center",
  //                         }}
  //                       >
  //                         <strong>{orderItem.item_code}</strong>
  //                       </p>
  //                     </div>
  //                     <div
  //                       className="person-upi-code"
  //                       style={{
  //                         border: "0px",
  //                         textAlign: "center",
  //                         justifyContent: "center",
  //                         alignItems: "flex-start",
  //                       }}
  //                     >
  //                       <img
  //                         src={mainQR}
  //                         className="img-fit"
  //                         style={{ width: "30%" }}
  //                       />
  //                     </div>
  //                   </div>
  //                 </div>
  //                 <div
  //                   className="product-final-views"
  //                   style={{
  //                     padding: "0",
  //                     border: "0",
  //                     lineHeight: "0",
  //                     margin:"1rem 0",
  //                   }}
  //                 >
  //                   <div
  //                     className="product-views"
  //                     style={{
  //                       padding: "0",
  //                       lineHeight: "0",
  //                       margin:"0",
                       
  //                     }}
  //                   >
  //                       <div className="info-col-5">
  //                       <div className="info-table" style={{ border: "0" }}>
  //                         <table
  //                           style={{
  //                             border: "1px solid #333",
  //                             borderTop: "0",
  //                             borderRight: "0",
  //                             borderBottom: "0",
  //                             borderCollapse: "collapse",
  //                             width: "100%",
  //                             height: "100%"
  //                           }}
  //                         >
  //                           <thead>
  //                             {/* <tr style={{ padding: "0" }}>


                                
                                
  //                               <th
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   padding: "3px 0",
  //                                   verticalAlign: "middle",
  //                                   margin:"0",
  //                                   lineHeight: "0px",
  //                                 }}
  //                               >
                                  
  //                                 <span
  //                                   style={{
  //                                     fontSize: "8px",
  //                                     display: "block",
  //                                     padding: "0",
  //                                     margin:"0",
  //                                     lineHeight: "10px",
                                    
  //                                   }}
  //                                 >
  //                                   Additional Style Name
  //                                 </span>
                                 
  //                               </th>
  //                               <th
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   padding: "3px 0",
  //                                   verticalAlign: "middle",
  //                                   margin:"0",
  //                                   lineHeight: "0px",
  //                                 }}
  //                               >
  //                                 <span
  //                                   style={{
  //                                     fontSize: "8px",
  //                                     display: "block",
  //                                     padding: "0",
  //                                     margin:"0",
  //                                     lineHeight: "10px",
  //                                   }}
  //                                 >
  //                                   Additional Style Value
  //                                 </span>
  //                               </th>
  //                             </tr> */}
  //                           </thead>
  //                           <tbody>
  //                           {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket"
  //                               ? Object.keys(
  //                                 orderItem["styles"]["jacket"]["style"]
  //                               ).map((data, i) => {
  //                                 if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
  //                                   return (
  //                                     <tr key={i}  >
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderLeft: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0"
  //                                           }}
  //                                         >
  //                                           {data}
  //                                         </span>
  //                                       </td>
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0",
  //                                           }}
  //                                         >
  //                                           {orderItem["styles"]["jacket"]["style"][data][
  //                                                   "value"
  //                                                   ]}
  //                                         </span>
  //                                       </td>
  //                                     </tr>
  //                                   );
  //                                 }
                                  
  //                               })
  //                               : orderItem.item_name == "suit" &&
  //                                 orderItem.item_code.split(" ")[0] == "pant"
  //                                 ? Object.keys(orderItem["styles"]["pant"]["style"]).map(
  //                                   (data, i) => {
  //                                     if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
  //                                       return (
  //                                         <tr key={i} >
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderLeft: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0"
  //                                           }}
  //                                         >
  //                                           {data}
  //                                         </span>
  //                                       </td>
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0",
  //                                           }}
  //                                         >
  //                                           {orderItem["styles"]["pant"]["style"][data][
  //                                                   "value"
  //                                                   ]}
  //                                         </span>
  //                                       </td>
  //                                     </tr>
  //                                       );
  //                                     }
                                      
  //                                   }
  //                                 )
  //                                 : Object.keys(orderItem.styles.style).map(
  //                                   (data, i) => {
  //                                     if(orderItem['styles']['style'][data]['additional'] == 'true'){
  //                                   return (
  //                                     <tr key={i} >
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderLeft: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0"
  //                                           }}
  //                                         >
  //                                           {data}
  //                                         </span>
  //                                       </td>
  //                                       <td
  //                                         style={{
  //                                           borderRight: "1px solid #333",
  //                                           borderTop: "1px solid #333",
  //                                           borderBottom: "1px solid #333",
  //                                           textAlign: "center",
  //                                           backgroundColor: "white",
  //                                           paddingLeft: "0.25rem",
  //                                           margin: "0",
  //                                           padding: "2px 0",
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "7px",
  //                                             lineHeight: "0",
  //                                             margin: "0",
  //                                             padding:"0",
  //                                           }}
  //                                         >
  //                                           {
  //                                               orderItem.styles.style[data][
  //                                               "value"
  //                                               ]
  //                                             }
  //                                         </span>
  //                                       </td>
  //                                     </tr>
  //                                       );
  //                                     }
  //                                   }
  //                                 )}
  //                           </tbody>
  //                         </table>
  //                       </div>
  //                     </div>

  //                     {/* <div className="info-col-12">
  //                       <div
  //                         className="view-lists"
  //                         style={{
  //                           width: "100%",
  //                           padding: "10px 0",
  //                           border: "0",
  //                           lineHeight: "0",
  //                         }}
  //                       >
  //                         <table
  //                           style={{
  //                             border: "0",
  //                             borderCollapse: "collapse",
  //                             padding: "0",
  //                             width: "100%",
  //                           }}
  //                         >
  //                           <thead>
  //                             <tr style={{ padding: "0" }}>
  //                               {orderItem.item_name == "suit" &&
  //                                 orderItem.item_code.split(" ")[0] == "jacket"
  //                                 ? Object.keys(
  //                                   orderItem["styles"]["jacket"]["style"]
  //                                 ).map((data, i) => {
  //                                   if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
  //                                     return (
  //                                       <th
  //                                         key={i}
  //                                         style={{
  //                                           border: "0",
  //                                           backgroundColor: "white",
  //                                           color: "#000",
  //                                           textAlign: "center",
  //                                           textTransform: "capitalize",
  //                                           margin:"0",
  //                                           padding:"0",
  //                                           border: "1px solid #333",
                                            
                                          
  //                                         }}
  //                                       >
  //                                         <span
  //                                           style={{
  //                                             fontSize: "10px",
  //                                             lineHeight: "20px",
  //                                             margin:"0",
  //                                             padding:"0 0 10px 0",
  //                                             fontWeight: "600",
                                            
                                             
  //                                           }}
  //                                         >
  //                                           {data}
  //                                         </span>
  //                                       </th>
  //                                     );
  //                                   }
                                   
  //                                 })
  //                                 : orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] == "pant"
  //                                   ? Object.keys(
  //                                     orderItem["styles"]["pant"]["style"]
  //                                   ).map((data, i) => {
  //                                     if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
  //                                       return (
  //                                         <th
  //                                           key={i}
  //                                           style={{
  //                                             border: "0",
  //                                             backgroundColor: "white",
  //                                             color: "#000",
  //                                             textAlign: "center",
  //                                             textTransform: "capitalize",
  //                                             margin:"0",
  //                                             padding:"0",
  //                                             border: "1px solid #333",
                                             
                                             
  //                                           }}
  //                                         >
  //                                           <span
  //                                             style={{
  //                                               fontSize: "10px",
  //                                               lineHeight: "20px",
  //                                               margin:"0",
  //                                               padding:"0 0 10px 0",
  //                                               fontWeight: "600",
                                              
                                              
  //                                             }}
  //                                           >
  //                                             {data}
  //                                           </span>
  //                                         </th>
  //                                       );
  //                                     }
                                      
  //                                   })
  //                                   : Object.keys(orderItem.styles.style).map(
  //                                     (data, i) => {
  //                                       if(orderItem['styles']['style'][data]['additional'] == 'true'){
  //                                         return (
  //                                           <th
  //                                             key={i}
  //                                             style={{
  //                                               border: "0",
  //                                               backgroundColor: "white",
  //                                               color: "#000",
  //                                               textAlign: "center",
  //                                               textTransform: "capitalize",
  //                                               margin:"0",
  //                                               padding:"0",
  //                                               border: "1px solid #333",
                                            
                                               
  //                                             }}
  //                                           >
  //                                             <span
  //                                               style={{
  //                                                 fontSize: "10px",
  //                                                 lineHeight: "20px",
  //                                                 margin:"0",
  //                                                 padding:"0 0 10px 0",
  //                                                 fontWeight: "600",
                                                 
                                                 
  //                                               }}
  //                                             >
  //                                               {data}
  //                                             </span>
  //                                           </th>
  //                                         );
  //                                       }
                                        
  //                                     }
  //                                   )}
  //                             </tr>
  //                           </thead>
  //                           <tbody>
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket"
  //                               ? Object.keys(
  //                                 orderItem["styles"]["jacket"]["style"]
  //                               ).map((data, i) => {
  //                                 if(orderItem["styles"]["jacket"]["style"][data]['additional'] == 'true'){
  //                                   return (
  //                                     <td
  //                                       key={i}
  //                                       align="center"
  //                                       style={{
  //                                         backgroundColor: "white",
  //                                         color: "#000",
  //                                         textAlign: "center",
  //                                         padding: "5px 0",
  //                                         margin:"0",
  //                                         border: "1px solid #333",
                                          
  //                                       }}
  //                                     >
  //                                       <p
  //                                         style={{
  //                                           fontSize: "9px",
  //                                           lineHeight: "0",
  //                                           textAlign: "center",
  //                                         }}
  //                                       >
  //                                         {
  //                                           orderItem["styles"]["jacket"]["style"][data][
  //                                           "value"
  //                                           ]
  //                                         }
  //                                       </p>
  //                                     </td>
  //                                   );
  //                                 }
                                  
  //                               })
  //                               : orderItem.item_name == "suit" &&
  //                                 orderItem.item_code.split(" ")[0] == "pant"
  //                                 ? Object.keys(orderItem["styles"]["pant"]["style"]).map(
  //                                   (data, i) => {
  //                                     if(orderItem["styles"]["pant"]["style"][data]['additional'] == 'true'){
  //                                       return (
  //                                         <td
  //                                           key={i}
  //                                           align="center"
  //                                           style={{
  //                                             backgroundColor: "white",
  //                                             color: "#000",
  //                                             textAlign: "center",
  //                                             padding: "5px 0",
  //                                             border: "1px solid #333",
  //                                           }}
  //                                         >
  //                                           <p
  //                                             style={{
  //                                               fontSize: "9px",
  //                                               lineHeight: "0",
  //                                               textAlign: "center",
  //                                             }}
  //                                           >
  //                                             {
  //                                               orderItem["styles"]["pant"]["style"][data][
  //                                               "value"
  //                                               ]
  //                                             }
  //                                           </p>
  //                                         </td>
  //                                       );
  //                                     }
                                      
  //                                   }
  //                                 )
  //                                 : Object.keys(orderItem.styles.style).map(
  //                                   (data, i) => {
  //                                     if(orderItem['styles']['style'][data]['additional'] == 'true'){
  //                                       return (
  //                                         <td
  //                                           key={i}
  //                                           align="center"
  //                                           style={{
  //                                             backgroundColor: "white",
  //                                             color: "#000",
  //                                             textAlign: "center",
  //                                             padding: "5px 0",
  //                                              border: "1px solid #333",
  //                                           }}
  //                                         >
  //                                           <p
  //                                             style={{
  //                                               fontSize: "9px",
  //                                               lineHeight: "0",
  //                                               textAlign: "center",
  //                                             }}
  //                                           >
  //                                             {
  //                                               orderItem.styles.style[data][
  //                                               "value"
  //                                               ]
  //                                             }
  //                                           </p>
  //                                         </td>
  //                                       );
  //                                     }
  //                                   }
  //                                 )}
  //                           </tbody>
  //                         </table>
  //                       </div>
  //                     </div> */}
  //                   </div>
  //                 </div>
  //                 <div
  //                   className="monogram-views"
  //                   style={{ border: "0", paddingTop: "10px", margin: "0" }}
  //                 >
  //                   <div className="info-col-5">
  //                     { orderItem.item_code.split(" ")[0] == "pant" ?
  //                     <></>
  //                     :
  //                     <div
  //                       className="monogram-table"
  //                       style={{ width: "100%", border: "0", padding: "0" }}
  //                     >
  //                       <table
  //                         width="100%"
  //                         style={{
  //                           width: "100%",
  //                           border: "1px solid #333",
  //                           borderRight: "0",
  //                           borderBottom: "0",
  //                           borderTop: "0",
  //                           borderCollapse: "collapse",
  //                         }}
  //                       >
  //                         <thead>
  //                           <tr style={{ padding: "0.35rem 0 0.55rem 0" }}>
  //                             <th
  //                               colSpan="2"
  //                               align="center"
  //                               style={{
  //                                 borderTop: "1px solid #333",
  //                                 borderRight: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span style={{ fontSize: "10px" }}>
  //                                 Monogram
  //                               </span>
  //                             </th>
  //                           </tr>
  //                         </thead>
  //                         <tbody>
  //                           <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 Position
  //                               </span>
  //                             </th>
  //                             <td
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 padding: "0.35rem 0 0.45rem 0",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 {orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] ==
  //                                   "jacket" &&
  //                                   orderItem["styles"]["jacket"]["monogram"] !==
  //                                   undefined
  //                                   ? orderItem["styles"]["jacket"]["monogram"][
  //                                   "side"
  //                                   ]
  //                                   : orderItem["styles"]["monogram"] !==
  //                                     undefined
  //                                     ? orderItem["styles"]["monogram"]["side"]
  //                                     : ""}
  //                               </span>
  //                             </td>
  //                           </tr>
  //                           <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 Style
  //                               </span>
  //                             </th>
  //                             <td
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 {orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] ==
  //                                   "jacket" &&
  //                                   orderItem["styles"]["jacket"]["monogram"] !==
  //                                   undefined
  //                                   ? orderItem["styles"]["jacket"]["monogram"][
  //                                   "font"
  //                                   ]
  //                                   : orderItem["styles"]["monogram"] !==
  //                                     undefined
  //                                     ? orderItem["styles"]["monogram"]["font"]
  //                                     : ""}
  //                               </span>
  //                             </td>
  //                           </tr>
  //                           <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
  //                             <th
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 Font Color
  //                               </span>
  //                             </th>
  //                             <td
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 {orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] ==
  //                                   "jacket" &&
  //                                   orderItem["styles"]["jacket"]["monogram"] !==
  //                                   undefined
  //                                   ? orderItem["styles"]["jacket"]["monogram"][
  //                                   "color"
  //                                   ]
  //                                   : orderItem["styles"]["monogram"] !==
  //                                     undefined
  //                                     ? orderItem["styles"]["monogram"]["color"]
  //                                     : ""}
  //                               </span>
  //                             </td>
  //                           </tr>
  //                           <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
  //                             <td
  //                               colSpan="2"
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 Monogram Name :{" "}
  //                                 {orderItem.item_name == "suit" &&
  //                                   orderItem.item_code.split(" ")[0] ==
  //                                   "jacket" &&
  //                                   orderItem["styles"]["jacket"]["monogram"] !==
  //                                   undefined
  //                                   ? orderItem["styles"]["jacket"]["monogram"][
  //                                   "tag"
  //                                   ]
  //                                   : orderItem["styles"]["monogram"] !==
  //                                     undefined
  //                                     ? orderItem["styles"]["monogram"]["tag"]
  //                                     : ""}
  //                               </span>
  //                             </td>
  //                           </tr>
  //                           <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
  //                             <td
  //                               colSpan="2"
  //                               style={{
  //                                 borderRight: "1px solid #333",
  //                                 borderBottom: "1px solid #333",
  //                                 borderLeft: "1px solid #333",
  //                                 backgroundColor: "white",
  //                                 color: "#000",
  //                                 textAlign: "center",
  //                                 lineHeight: "0",
  //                                 verticalAlign: "middle",
  //                               }}
  //                             >
  //                               <span
  //                                 style={{ fontSize: "10px", lineHeight: "0" }}
  //                               >
  //                                 Optional:
  //                               </span>
  //                             </td>
  //                           </tr>
  //                         </tbody>
  //                       </table>
  //                     </div> }
                     
  //                   </div>
  //                   <div className="info-col-7">
  //                   <div
  //                       className="manual-views-table"
  //                       style={{ border: "0", marginLeft: "30px" }}
  //                     >
  //                       <table
  //                         style={{
  //                           border: "1px solid #333",
  //                           borderRight: "0",
  //                           borderBottom: "0",
  //                           borderTop: "0",
  //                           borderCollapse: "collapse",
  //                         }}
  //                       >
  //                         <thead>
  //                           <tr style={{ padding: "0.5rem " }}>
  //                             {orderItem.styles.fabric_code !== undefined ? (
  //                               <th
  //                                 style={{
  //                                   borderTop: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   verticalAlign: "middle",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   Fabric
  //                                 </span>
  //                               </th>
  //                             ) : (
  //                               <></>
  //                             )}
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket" &&
  //                               orderItem.styles.jacket.lining_code !==
  //                               undefined ? (
  //                               <th
  //                                 style={{
  //                                   borderTop: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   verticalAlign: "middle",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   Lining
  //                                 </span>
  //                               </th>
  //                             ) : orderItem.styles.lining_code !== undefined ? (
  //                               <th
  //                                 style={{
  //                                   borderTop: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   verticalAlign: "middle",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   Lining
  //                                 </span>
  //                               </th>
  //                             ) : (
  //                               <></>
  //                             )}
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket" &&
  //                               orderItem.styles.jacket.piping !== undefined ? (
  //                               <th
  //                                 style={{
  //                                   borderTop: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   verticalAlign: "middle",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   Piping
  //                                 </span>
  //                               </th>
  //                             ) : orderItem.styles.piping !== undefined ? (
  //                               <th
  //                                 style={{
  //                                   borderTop: "1px solid #333",
  //                                   borderRight: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   verticalAlign: "middle",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   Piping
  //                                 </span>
  //                               </th>
  //                             ) : (
  //                               <></>
  //                             )}
  //                           </tr>
  //                         </thead>
  //                         <tbody>
  //                           <tr style={{ padding: "0.1rem 0 0.5rem 0" }}>
  //                             {orderItem.styles.fabric_code !== undefined ? (
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   {orderItem.styles.fabric_code}
  //                                 </span>
  //                               </td>
  //                             ) : (
  //                               <></>
  //                             )}
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket" &&
  //                               orderItem.styles.jacket.lining_code !==
  //                               undefined ? (
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   {orderItem.styles.jacket.lining_code}
  //                                 </span>
  //                               </td>
  //                             ): orderItem.styles.lining_code !== undefined ? (
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   {orderItem.styles.lining_code}
  //                                 </span>
  //                               </td>
  //                             ) : (
  //                               <></>
  //                             )}
  //                             {orderItem.item_name == "suit" &&
  //                               orderItem.item_code.split(" ")[0] == "jacket" &&
  //                               orderItem.styles.jacket.piping !== undefined ? (
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   {orderItem.styles.jacket.piping}
  //                                 </span>
  //                               </td>
  //                             ): orderItem.styles.piping !== undefined ? (
  //                               <td
  //                                 style={{
  //                                   borderRight: "1px solid #333",
  //                                   borderBottom: "1px solid #333",
  //                                   borderLeft: "1px solid #333",
  //                                   backgroundColor: "white",
  //                                   color: "#000",
  //                                   textAlign: "center",
  //                                   lineHeight: "4px",
  //                                 }}
  //                               >
  //                                 <span style={{ fontSize: "10px" }}>
  //                                   {orderItem.styles.piping}
  //                                 </span>
  //                               </td>
  //                             ) : (
  //                               <></>
  //                             )}
  //                           </tr>
  //                         </tbody>
  //                       </table>
  //                     </div>
  //                     <div
  //                       className="notes"
  //                       style={{
  //                         paddingTop: "10px",
  //                         height: "100px",
  //                         marginLeft: "30px",
  //                       }}
  //                     >
  //                       <div
  //                         className="mesurement-note"
  //                         style={{ border: "1px solid #333", height: "70px" }}
  //                       >
  //                         <h2
  //                           style={{
  //                             fontSize: "10px",
  //                             paddingBottom: "0.25rem",
  //                             backgroundColor: "white",
  //                             color: "#000",
  //                             wordSpacing: "0",
  //                             borderBottom: "1px solid #333",
  //                             textAlign: "center",
  //                             margin: 0
  //                           }}
  //                         >
  //                           Styling Notes:
  //                         </h2>
  //                         <p
  //                           style={{
  //                             fontSize: "10px",
  //                             paddingLeft: "0",
  //                             paddingTop: "0.25rem",
  //                             textAlign: "center",
  //                           }}
  //                         >
  //                           {orderItem.styles.note}
  //                         </p>
  //                       </div>
  //                     </div>
  //                   </div>
  //                 </div>
  //               </div>
  //             </>
  //           );
  //         })}
        
  //         {singleOrderArray.map((reference , j) => {
  //           return (
  //             <div key={j} style={{ height: "500px", overflow:"hidden", marginTop:"0px", marginBottom: "100px" }}>
  //               {reference.item_name == "suit" &&
  //                reference.item_code.split(" ")[0] == "jacket" &&
  //                reference['styles']["jacket"]['referance_image']!== undefined ? 
  //                 <>
  //                 <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name.charAt(0)}(${reference.item_code})`}</p>
  //                 <img src={PicBaseUrl + reference['styles']["jacket"]['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/>
  //                 </> 
  //               : 
  //                 reference.item_name == "suit" &&
  //                 reference.item_code.split(" ")[0] == "pant" &&
  //                 reference['styles']["pant"]['referance_image']!== undefined ?
  //                 <>
  //                 <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name}(${reference.item_code})`}</p>
  //                 <img src={PicBaseUrl + reference['styles']["pant"]['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto',}}/>
  //                 </>
  //               : reference['styles']['referance_image'] !== undefined ?
  //                 <>
  //                 <p style={{textAlign:"center", textTransform:'capitalize'}}>{`${reference.item_name}(${reference.item_code})`}</p>
  //                 <img src={PicBaseUrl + reference['styles']['referance_image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/>
  //                 </>
  //               :
  //                 <></>
  //               }
  //             </div>
  //           )
  //         })}

  //         { thisOrder['customer_id']['image'] !== undefined &&
  //         <div>
  //           <p style={{textAlign:"center", textTransform:'capitalize'}}>Customer Image</p>
  //           <img src={PicBaseUrl + thisOrder['customer_id']['image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto'}}/>
  //         </div>}
  //       </div>
  //     </>
  //   );
  //   let elementAsString = renderToString(htmlElement);
  //   doc.html(elementAsString, {
  //     async callback(doc) {
  //       window.open(doc.output("bloburl"), "_blank");
  //     }
  //   });
  // };


  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };

  // this function changes the order displayed on the screen according to the status

  const handleStatusChange = (e) => {
    setStatusName(e.target.dataset.name)
  }

  // handle on click show order items details-------------------------
  const handleClickFabricDialogOpen = () => {
    setFabricDialogOpen(true);
  };

  const handleCloseFabricDialogOpen = () => {
    setFabricDialogOpen(false);
  };


  const handleShowOrderItemsDetails = (e, id) => {
    const sinOrder  = orders.filter((order) =>{
      return id == order._id;
    })
    setOrder(sinOrder[0])
    let string = "";
    for(let x of sinOrder[0]['order_items']){
      if(string.length > 0){
        string = string +  ", " + x.quantity + " " + x.item_name
      }else{
        string = x.quantity + " " + x.item_name
      }
    }
    setOrderItemString(string)  
    setAnchorEl(e.currentTarget);  
  }


  const handleShowFabricDetails = () => {
    const styleFabricArray = [];
    for(let x of order['order_items']){
      
      let ind = 1;
      for(let styles of Object.keys(x['styles'][0])){
        const styleObject = {};
        styleObject['item_name'] = x['item_name'] + " " + ind
        styleObject['fabric'] = x['styles'][0][styles]['fabric_code']
        styleFabricArray.push(styleObject)
        ind = ind + 1 
      }
     
    }

    setStyleFabricCode(styleFabricArray)
    handleClickFabricDialogOpen()
    handleClosePopup()
  }


 

  // -----------------------------------------------------------------
  // static function--------------------------------------------------
  const fetchAllOrders = async () => {
    const res = await axiosInstance.post("/groupOrders/fetchAll", {
      token: user.data.token,
    });
    
    if (res.data.status === true) {
    let L = res.data.data?.filter((x) => x.order_status == "New Order");
    setLength1(L.length);
    let L1 = res.data.data?.filter((x) => x.order_status == "Modified");
    setLength2(L1.length);
    let L2 = res.data.data?.filter((x) => x.order_status == "Rush");
    setLength3(L2.length);
    let L3 = res.data.data?.filter((x) => x.order_status == "Processing");
    setLength4(L3.length);
    let L4 = res.data.data?.filter((x) => x.order_status == "Shipment");
    setLength5(L4.length);
    let L5 = res.data.data?.filter((x) => x.order_status == "Sent");
    setLength6(L5.length);
    }
  };
  const fetchRetailers = async () => {
    const res = await axiosInstance.post("/retailer/fetchAll", {
      token: user.data.token,
    });
    if(res.data.status === true){
      setShowRetailers(true)
      setRetailers(res.data.data);
  }
  };  
  const fetchData = async (page, limit, status, name, name1, d) => {
    const res = await axiosInstance.post(
      `/groupOrders/fetchPaginate/?page=${page}&limit=${limit}&order_status=${status}&name=${name}&retailerName=${name1}&orderDate=${d}`,
      {
        token: user.data.token,
      }
    );


    setDoc(res.data.meta.totalDocs);
    setOrders(res.data.data);
  };
  const fetchOrder = async(id) => {
    const res = await axiosInstance.post("/groupOrders/fetchDatag/" + id, {token: user.data.token})
    setOrder(res.data.data)
  }
  const fetchProducts = async () => {
    const res = await axiosInstance.post("/product/fetchAll/0/0", {
      token: user.data.token,
    });
    const productObject = {}
    for(let x of res.data.data){
      const featureArray = []
      for(let y of x.features){
        if(y.additional == false){
          featureArray.push(y.name)
        }
      }
      productObject[x.name] = featureArray

    }
    setProductFeaturesObject(productObject)
    setProducts(res.data.data);
  };
  const fetchPageOrders = async(par, skip) => {
    const res = await axiosInstance.post("/groupOrders/fetchAdminPaginateNew/" + skip, {
      token: user.data.token,
      par: par
    })
    console.log(par)
    console.log(res.data)

    if(res.data.status == true){
      setShowOrders(true)
      setOrders(res.data.data)
    }else{
      setShowOrders(false)
      setOrders([])
    }
  }


  // -----------------------------------------------------------------



  const handleClosePopup = () => {
    setAnchorEl(null);
  };

  const openPopup = Boolean(anchorEl);

  const pid = openPopup ? 'simple-popover' : undefined;


  const action = (
    <React.Fragment>
      <Button color="secondary" size="small" onClick={handleClose}>
        UNDO
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleClose}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </React.Fragment>
  );

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="manage-page">
          <div className="top-heading-title">
            <strong>Search Order</strong>
          </div>
          <div className="searchstyle searchstyle-one">
            <div className="searchinput-inner">
              <p>Group Order Name</p>
              <input
                type="text"
                className="searchinput"
                onChange={searchChange}
                placeholder="Jason Wills"
              />
            </div>
            <div className="searchinput-inner">
              <p>Retailer</p>
              <select
                name="workername"
                id="retailer"
                value={retailer}
                onChange={searchSelectChange}
                className="searchinput"
              >
                <option value=" ">Select Retailer name</option>
                {showRetailers
                // retailers.length > 0 && retailers !== null 
                ? (
                  retailers.map((data, i) => {
                    return (                    
                    <option key={i} value={data.retailer_name}>
                      {data.retailer_name.charAt(0).toUpperCase() +
                        data.retailer_name.slice(1)}
                    </option>
                  )})
                ) : (
                  <></>
                )}
              </select>
            </div>
            <div className="searchinput-inner">
              <p>Date</p>
              <input
                type="date"
                className="searchinput"
                onChange={searchDateChange}
              />
            </div>
            
            <div>
            <span style={{marginLeft: "10px"}}>
              <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button>
              </span>
            </div>
          </div>
        </div>
        <div className="order-table">
          <div className="order-top-tabs filterbutton">
            <div className="multipleChange-first">
              <p>
                {" "}
                <strong> {statusName} </strong>{" "}
              </p>
              <ul>
                <li
                  className = {statusName == "New Order" ? "active" : ""}
                  data-name="New Order"
                  onClick={handleStatusChange}
                >
                    New Orders ({l1})
                  </li>
                <li
                  className = {statusName == "Rush Order" ? "active" : ""}
                  id="rushorder"
                  data-name="Rush Order"
                  onClick={handleStatusChange}
                >
                    Rush Orders ({l3})
                  </li>
                <li
                  className = {statusName == "Modified" ? "active" : ""}
                  data-name="Modified"
                  onClick={handleStatusChange}
                >
                    Modified ({l2})
                  </li>
                <li
                  className = {statusName == "Processing" ? "active" : ""}
                  data-name="Processing"
                  onClick={handleStatusChange}
                >
                    Processing ({l4})
                  </li>
                <li
                  className = {statusName == "Ready for Shipment" ? "active" : ""}
                  data-name="Ready for Shipment"
                  onClick={handleStatusChange}
                >
                    Ready for Shipment ({l5})
                  </li>
                <li
                  className = {statusName == "Sent" ? "active" : ""}
                  data-name="Sent"
                  onClick={handleStatusChange}
                >
                    Sent ({l6})
                  </li>
              </ul>
            </div>
            <div className="multipleChange-last">
              {checkboxItem.length > 0 && (
                <div className="multipleChange">
                  <p>
                    {" "}
                    <strong> Multiple Status Change </strong>{" "}
                  </p>
                  <select
                    className="multi-select"
                    value=""
                    onChange={handleUpdateStatus}
                  >
                    <option>Change Status</option>
                    <option value="New Order">New Order</option>
                    <option value="Modified">Modified</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipment">Ready for shipping</option>
                    <option value="Sent">Sent </option>
                    
                  </select>
                </div>
              )}
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                {/* <th>Retailer</th> */}
                <th>Order #</th>
                <th>GROUP NAME</th>
                <th>Order Date</th>
                <th>QTY</th>
                {statusName !== "Ready for Shipment" && statusName !== "Sent" 
                    ?
                    <th>VIEW/Edit</th>
                    :
                    <th>VIEW</th>
                }
                
                <th>Pattern PDF</th>
                
                {statusName !== "Sent" 
                    ?
                    <th>Update Status</th>
                    :
                    <></>
                    }
                  
                

              </tr>
            </thead>
            <tbody>
              {orders !== null && orders.length > 0 ? (
                orders.map((order, i) => {
                  // if (order.order_status === "New Order") {
                    return (
                      <tr key={order['_id']}>
                        <th>
                          <input
                            type="checkbox"
                            value={order._id}
                            onChange={handleId}
                          />
                        </th>
                        <td>
                          <strong>{i + 1 + ((page - 1) * 5)}</strong>
                        </td>
                        {/* <td>{order.retailerName ? order.retailerName.charAt(0).toUpperCase() + order.retailerName.slice(1) : ""}</td> */}
                        <td>{order.orderId}</td>
                        <td>{order.name ? order.name.charAt(0).toUpperCase() + order.name.slice(1) : ""}</td>
                        <td>{order.orderDate}</td>
                        <td className="orderQuantity">
                          <span 
                            // onMouseEnter = {(e) => handleShowOrderItemsDetails(e, order._id)}
                            onClick = {(e) => handleShowOrderItemsDetails(e, order._id)}
                            // onClick = {(e) => handleShowFabricDetails(e, order._id)}
                          >
                            {order.product_quantity}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {/* <button
                              onClick={() => handleViewthisOrderCustomer(order._id)}
                              target="_blank"
                              rel="noreferrer"
                              className="action"
                            >
                              view
                            </button> */}
                           <Link to={`/admin/viewSingleGroupOrderCustomers/${order._id}`}>view</Link>
                          </strong>
                          
                          {statusName !== "Ready For Shipment" && statusName !== "Sent"
                          ?
                          <Link
                          to={`/admin/editGroupOrder/${order._id}`}
                          className="action"
                          >
                           |Edit
                          </Link>
                          :
                            <></> 
                          } 
                          
                        </td>
                        <td>
                          <strong>
                            <Link to="#" className="action">
                              Upload
                            </Link>
                          </strong>{" "}
                          | <a href="#">NA</a>
                        </td>
                        {statusName !== "Sent" 
                          ?
                          <td>
                          <select
                            className="order-change"
                            value={order.order_status}
                            onChange={(e) =>
                              handleChange(order._id, e.target.value)
                            }
                          >
                            <option value="New Order">New Order</option>
                            <option value="Modified">Modified</option>
                            <option value="Processing">Processing</option>
                            <option value="Shipment">Ready for shipping</option>
                            <option value="Sent">Sent </option>
                          </select>
                        </td>
                          :
                          <></>
                          }
                        
                      </tr>
                    );
                  // }
                })
              ) : (
                <tr>
                  <td>
                    <p>No data found!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Stack spacing={2}>
            <Pagination
              count={count}
              page={page}
              color="primary"
              onChange={handleChangePage}
            />
          </Stack>
        </div>
        {success && (
          <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
            <Alert
              onClose={handleClose}
              severity="success"
              sx={{ width: "100%" }}
            >
              order status updated successfully!
            </Alert>
          </Snackbar>
        )}
        {error && (
          <Snackbar
            open={open}
            autoHideDuration={2000}
            onClose={handleClose}
            action={action}
          >
            <Alert
              onClose={handleClose}
              severity="error"
              sx={{ width: "100%" }}
            >
              {errorMsg}
            </Alert>
          </Snackbar>
        )}
      </div>
      <div>
      <Popover
        id={pid}
        open={openPopup}
        anchorEl={anchorEl}
        onClose={handleClosePopup}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Typography sx={{ p: 2 }}>{orderItemString} <span><OpenInNewIcon onClick={handleShowFabricDetails}/></span></Typography>
      </Popover>
    </div>
    <div>
      <Dialog
        open={fabricDialogOpen}
        onClose={handleCloseFabricDialogOpen}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          <div style={{display:"flex"}}>
          Fabric Details for {order['orderId']}
          <div style={{marginLeft: "auto"}}>
            <CloseIcon onClick={handleCloseFabricDialogOpen}/>
          </div>
          </div>
        </DialogTitle>

        <DialogContent>
          <TableContainer>
            <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
              <TableHead>
                <TableRow>
                  <TableCell>S no.</TableCell>
                  <TableCell>Item </TableCell>
                  <TableCell align="right">Fabric Code</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {styleFabricCode.map((row, index) => (
                  <TableRow
                    key={row.name}
                    sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {index + 1}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {row.item_name}
                    </TableCell>
                    <TableCell align="right">
                      {row.fabric}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        
      </Dialog>
    </div>

    <div>
      <Dialog
        open={openOrderCustomerTable}
        onClose={handleCloseOrderCustomerTable}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
        </DialogTitle>
        <DialogContent>
          <div style={{display: "flex", flexDirection: "row", justifyContent:"space-around"}}>
            <div>
              <div>Group Name: <span>{order[0] !== undefined ? order[0]['name'].toUpperCase() : ""}</span></div>
              <div>Retailer: <span>{order[0] !== undefined ? order[0]['retailerName'].toUpperCase() : ""}</span></div>
            </div>
            <div>

              {order[0] !==undefined
              ?
              order[0]['order_items'].map((item, i) => {
                return(
                  <div key={i}> {item['quantity'] + " "}<span style={{textTransform: "capitalize"}}>{item['item_name']}</span> </div>
                )
              })
              :
              
              <></>}

            </div>
          </div>
          <div style={{}}>
            <table>
              <thead>
                    <th><strong>S No. </strong></th>
                    <th><strong>Customer Name </strong></th>
                    <th><strong>Print / Edit </strong></th>
              </thead>
              <tbody>
                    {order[0] !== undefined
                    ?
                    order[0]['customers'].map((customer, index) => {
                      return(
                        <tr key={customer['_id']}>
                          <td>{index + 1}</td> 
                          <td><span style={{textTransform: "capitalize"}}>{customer['firstname']}</span>{" "}<span style={{textTransform: "capitalize"}}>{customer['lastname']}</span></td>
                          <td> <span className="generatePDf action" onClick={handlePrintPDF} data-customerId = {customer['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>Generate</span></td>
                          {/* <td> <span onClick={() => handleOpenPdf(order[0]['pdf'][customer['_id']])} target="_blank" rel="noreferrer" className="action" data-customerId = {customer['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>{order[0]['pdf'][customer['_id']] ? "View" : "N/A"}</span></td> */}
                          {
                           order[0]['pdf'] && order[0]['pdf'][customer['_id']]
                          ?
                          <td> <span className="generatePDf action" onClick={() => handleOpenPdf(order[0]['pdf'][customer['_id']])} target="_blank" rel="noreferrer" data-customerId = {customer['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>View</span></td>
                          :
                          <td> <span target="_blank" rel="noreferrer" className="action" data-customerId = {customer['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>N/A</span></td>
                          }
                        </tr>
                      )
                    })
                    :
                    <></>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={generatePDFButton}
        // onClose={}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
        </DialogTitle>
        <DialogContent>
          <div>
            <CircularProgress/>
          </div>
        </DialogContent>
      </Dialog> 
    </div>

    {success && (
        <Snackbar open={success} autoHideDuration={2000} onClose={handleClose}>
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar open={error} autoHideDuration={2000} onClose={handleClose}>
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
