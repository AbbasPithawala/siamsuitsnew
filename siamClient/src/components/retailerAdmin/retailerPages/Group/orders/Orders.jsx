import React, { useContext, useEffect, useState } from "react";
import "./Order.css";
import { Link } from "react-router-dom";
import { axiosInstance } from "./../../../../../config";
import { Context } from "./../../../../../context/Context";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import GradingIcon from "@mui/icons-material/Grading";
import RepeatIcon from "@mui/icons-material/Repeat";
import jsPDF from "jspdf";
import { PicBaseUrl, PicBaseUrl3, PicBaseUrl4 } from "./../../../../../imageBaseURL";
import mainQR from "./../../../../../images/PDFQR.png";
import { renderToString } from "react-dom/server";
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from "react-router-dom";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});
export default function Orders() {
  const { user } = useContext(Context);
  const [skip, setSkip] = useState(0);
  const [pageCount, setPageCount] = useState(10);
  const [group, setGroup] = useState([]);
  const [open, setOpen] = useState(false);
  const [previousOrder, setPreviousOrder] = useState({});
  // const [customerName, setCustomerName] = useState("");
  let [name, setName] = useState("");
  let [groupId, setGroupId] = useState("");
  let [code, setCode] = useState(user.data.retailer_code);
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);
  const [success, setSuccess] = useState(false);
  const [open3, setOpen3] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [order, setOrder] = useState([]);
  const [openOrderCustomerTable, setOpenOrderCustomerTable] = useState(false);
  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [products, setProducts] = useState([])
  const [generatePDFButton, setGeneratePDFButton] = useState(false)
  const navigate = useNavigate();

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    fetchGroupOrder(page, limit, code, name);
    fetchProducts();
  }, [page]);

  const fetchGroupOrder = async (page, limit, code, name) => {
    const res = await axiosInstance.post(
      `/groupOrders/fetchGroupOrder/?page=${page}&limit=${limit}&retailer_code=${code}&name=${name}`,
      { token: user.data.token }
    );
    setPageCount(res.data.meta.totalDocs);
    setGroup(res.data.data);
  };

  const count = Math.ceil(pageCount / limit);

  const handleChange = (e, p) => {
    const val = parseInt(p);
    setIndex(limit * (val - 1));
    setPage(val);
  };

  const searchFirstChange = async (event) => {
    const { value } = event.target;
    name = value;
    setName(value);
    fetchGroupOrder(1, limit, code, value.trim());
  };

  const handleClickOpen = (id) => {
    setName("");
    setOpen2(true);
    setGroupId(id);
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDelete = async () => {
    const res = await axiosInstance.post(
      `/groupOrders/deleteGroupOrder/${groupId}`,
      { token: user.data.token }
    );
    if (res) {
      fetchGroupOrder(page, limit, code, name);
    }
    setOpen2(false);
    setOpen(true);
    setSuccess(true);
  };

  // const handleViewthisOrderCustomer = async (order) => {
  //   fetchOrder(order);
  //   setOpenOrderCustomerTable(true)
  // }

  
  const handleViewthisOrderCustomer = async (order) => {

    fetchOrder(order);
    setOpenOrderCustomerTable(true)
  }
  const handleCloseOrderCustomerTable = () => {
    setOpenOrderCustomerTable(false)
  }

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

// console.log("existing orders ", existingOrders)
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
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "jacket " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          let itemsObject2 = {
            item_name: m["item_name"],
            item_code: "pant " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          orderItemsArray.push(itemsObject1);          
          orderItemsArray.push(itemsObject2);
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
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "jacket " + n,
            quantity: m["quantity"],
            repeatOrder: thisOrder["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject1);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject1);
          }

          j = j + 1;

          let itemsObject2 = {
            item_name: m["item_name"],
            item_code:  "pant " + n,
            quantity: m["quantity"],
            repeatOrder: thisOrder["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject2);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject2);
          }

          j = j + 1;
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
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {

          let itemsObject1 = {
             item_name: m["item_name"],
             item_code: "jacket " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: thisOrder.Suitmeasurements['jacket'],
             manualSize:
               thisOrder.manualSize == null ? (
                 <></>
               ) : (
                 thisOrder.manualSize["jacket"]
               ),
           };

           let itemsObject2 = {
             item_name: m["item_name"],
             item_code: "pant " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: thisOrder.Suitmeasurements['pant'],
             manualSize:
             thisOrder.manualSize == null ? (
                 <></>
               ) : (
                thisOrder.manualSize["pant"]
               ),
           };
           
           singleOrderArray.push(itemsObject1);
           
           singleOrderArray.push(itemsObject2);

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
    if(pdfString.data.status === true){
      setGeneratePDFButton(false)
      // setSnackbarOpen(true);
      // setSuccess(true);
      // setsuccessMsg("Group order place Successfully........");
      navigate("/retailer/viewGroupOrder");
    }
  };

  const handleOpenPdf = async(data) => {
    const stringPdf = data.split(".pdf")[0]
    
    const url = PicBaseUrl4 + stringPdf;
    window.open(url);

  }


  // ===================================================
  // =================static function===================

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

  // ===================================================
  // ===================================================

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
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>View Group Order</strong>
            <Link to="/retailer/newGroupOrder" className="custom-btn">
              {" "}
              <i className="fa-solid fa-plus"></i> Add New Group Order{" "}
            </Link>
          </div>
          <div className="searchstyle searchstyle-two">
            <div className="searchinput-inner">
              <p>Group Name</p>
              <input
                type="text"
                className="searchinput"
                onChange={searchFirstChange}
              />
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>GROUP NAME</th>
                <th>CUSTOMER QUANTITY</th>
                <th>VIEW</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {group.length > 0 ? (
                group.map((data, key) => {
                  return (
                    <tr key={key}>
                      <td>
                        <strong>{key + 1 + index}</strong>
                      </td>
                      <td>{data.name}</td>
                      <td>
                        {" "}
                        <strong>
                          {data.customer_quantity != data.customers.length
                          ?
                          data.customers.length + " / " + data.customer_quantity
                          :
                          data.customer_quantity
                          }
                          </strong>
                      </td>
                      <td>
                      <strong>
                            {/* <button
                              onClick={() => handleViewthisOrderCustomer(data._id)}
                              target="_blank"
                              rel="noreferrer"
                              className="action"
                            >
                              view
                            </button> */}
                            <Link to={`/retailer/viewSingleGroupOrderCustomers/${data._id}`}>view</Link>
                          </strong></td>
                      <td>
                        {data.isCompleted === false ? (
                          <span className="fromPendding">Form Pendding</span>
                        ) : (
                          <span className="formComplete">Form Complete</span>
                        )}
                      </td>
                      {/* <td>{customer.email ? customer.email : " -- "}</td> */}
                      <td>
                        {data.isCompleted === false ? (
                          <Link
                            to={`/retailer/editGroupOrder/${data._id}`}
                            className="action"
                          >
                            <EditIcon />
                          </Link>
                        ) : (
                          <Link
                            to={`/retailer/editGroupOrder/${data._id}`}
                            className="action"
                          >
                            <GradingIcon color={"primary"} />
                          </Link>
                        )}


                          <Link
                          to={`/retailer/repeatGroupOrder/${data._id}`}
                          className="action"
                          >
                          <RepeatIcon/>
                          </Link>
                        <DeleteOutlineIcon
                          onClick={() => handleClickOpen(data._id)}
                          color={"error"}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  <tr>
                    <td>
                      <strong>Not found data...</strong>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <Stack spacing={2}>
          <Pagination
            count={count}
            page={page}
            color="primary"
            onChange={handleChange}
          />
        </Stack>
      </div>

      <div>
        <Dialog
          open={open2}
          onClose={handleClose2}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Are you sure you want to delete?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose2}>Cancel</Button>
            <Button onClick={handleDelete} autoFocus>
              Yes
            </Button>
          </DialogActions>
        </Dialog>
        {success && (
          <Snackbar
            open={open}
            autoHideDuration={2000}
            onClose={handleClose}
            action={action}
          >
            <Alert
              onClose={handleClose}
              severity="success"
              sx={{ width: "100%" }}
            >
              Order deleted successfully!
            </Alert>
          </Snackbar>
        )}
      </div>

      <div>
      <Dialog
        open={openOrderCustomerTable}
        onClose={handleCloseOrderCustomerTable}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        className="viewGroupOrderDialog"
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
                    <th><strong>Generate</strong></th>
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
                          <td> <span className="generatePDf" onClick={handlePrintPDF} data-customerId = {customer['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>Generate</span></td>
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
    </main>
  );
}
