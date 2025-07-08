import React from "react";
import "./order.css";
import "./pdfStyle.css";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import { axiosInstance } from "./../../../../config";
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

// importing table components from MUI=====================

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";


import {
  PDFDownloadLink,
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  PDFViewer,
} from "@react-pdf/renderer";
import { red } from "@mui/material/colors";
import { height } from "@mui/system";
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle";
import { capitalize } from "@mui/material";
import axios from "axios";
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function NewOrder() {
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
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(10);
  const [index, setIndex] = useState(0);
  const [statusName, setStatusname] = useState("New Order");
  const [orderItemString, setOrderItemString] = useState("")
  const [styleFabricCode, setStyleFabricCode] = useState([])
  const pdfRef = useRef(null);
  let [name, setName] = useState("");
  let [name1, setName1] = useState("");
  let [d, setD] = useState("");  
  const [anchorEl, setAnchorEl] = useState(null);
  const [fabricDialogOpen, setFabricDialogOpen] = useState(false);

  const handleClickFabricDialogOpen = () => {
    setFabricDialogOpen(true);
  };

  const handleCloseFabricDialogOpen = () => {
    setFabricDialogOpen(false);
  };

  const fetchData = async (page, limit, status, name, name1, d) => {
    const res = await axiosInstance.post(
      `/customerOrders/fetchPaginate/?page=${page}&limit=${limit}&order_status=${status}&customerName=${name}&retailerName=${name1}&orderDate=${d}`,
      {
        token: user.data.token,
      }
    );
    setDoc(res.data.meta.totalDocs);
    setOrders(res.data.data);
  };

  useEffect(() => {
    fetchData(page, limit, statusName, name, name1, d);
  }, [page]);

  const count = Math.ceil(docLength / limit);

  const handleChangePage = (e, p) => {
    setIndex(limit * (p - 1));
    setPage(p);
  };

  const searchChange = async (event) => {
    const { value } = event.target;
    setName1("");
    setD("");
    name = value;
    setName(value);
    fetchData(1, limit, statusName, value.trim(), name1, d);
  };

  const searchSelectChange = async (event) => {
    const { value } = event.target;
    setName("");
    setD("");
    setRetailer(value);
    name1 = value;
    setName1(value);
    fetchData(1, limit, statusName, name, value.trim(), d);
  };

  const searchDateChange = async (event) => {
    const { value } = event.target;
    setName("");
    setName1("");
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

    fetchData(1, limit, statusName, name, name1, result);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await axiosInstance.post("/customerOrders/fetchAll", {
        token: user.data.token,
      });
      let L = res.data.data.filter((x) => x.order_status == "New Order");
      setLength1(L.length);
      let L1 = res.data.data.filter((x) => x.order_status == "Modified");
      setLength2(L1.length);
      let L2 = res.data.data.filter((x) => x.order_status == "Rush");
      setLength3(L2.length);
      let L3 = res.data.data.filter((x) => x.order_status == "Processing");
      setLength4(L3.length);
      let L4 = res.data.data.filter((x) => x.order_status == "Shipment");
      setLength5(L4.length);
      let L5 = res.data.data.filter((x) => x.order_status == "Sent");
      setLength6(L5.length);
    };
    fetchOrders();
  }, []);

  const handleChange = async (id, value) => {
    const statusChange = {
      order_status: value,
      token: user.data.token,
    };
    const res = await axiosInstance.put(
      `/customerOrders/updateStatus/${id}`,
      statusChange
    );
    if (res) {
      fetchData(page, limit, statusName, name, name1, d);
      const res = await axiosInstance.post("/customerOrders/fetchAll", {
        token: user.data.token,
      });
      let L = res.data.data.filter((x) => x.order_status == "New Order");
      setLength1(L.length);
      let L1 = res.data.data.filter((x) => x.order_status == "Modified");
      setLength2(L1.length);
      let L2 = res.data.data.filter((x) => x.order_status == "Rush");
      setLength3(L2.length);
      let L3 = res.data.data.filter((x) => x.order_status == "Processing");
      setLength4(L3.length);
      let L4 = res.data.data.filter((x) => x.order_status == "Shipment");
      setLength5(L4.length);
      let L5 = res.data.data.filter((x) => x.order_status == "Sent");
      setLength6(L5.length);
    }
    setOpen(true);
    setSuccess(true);
  };

  useEffect(() => {
    const fetchRetailers = async () => {
      const res = await axiosInstance.post("/retailer/fetchAll", {
        token: user.data.token,
      });
      setRetailers(res.data.data);
    };
    fetchRetailers();
  }, []);

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

  const handleStatusChange = async (e, p) => {
    const statusChange = {
      order_status: e.target.value,
      token: user.data.token,
    };
    for (let id of checkboxItem) {
      const res1 = await axiosInstance.put(
        `/customerOrders/updateStatus/${id}`,
        statusChange
      );
      if (res1) {
        fetchData(page, limit, statusName, name, name1, d);
        const res = await axiosInstance.post("/customerOrders/fetchAll", {
          token: user.data.token,
        });

        let L = res.data.data.filter((x) => x.order_status == "New Order");
        setLength1(L.length);
        let L1 = res.data.data.filter((x) => x.order_status == "Modified");
        setLength2(L1.length);
        let L2 = res.data.data.filter((x) => x.order_status == "Rush");
        setLength3(L2.length);
        let L3 = res.data.data.filter((x) => x.order_status == "Processing");
        setLength4(L3.length);
        let L4 = res.data.data.filter((x) => x.order_status == "Shipment");
        setLength5(L4.length);
        let L5 = res.data.data.filter((x) => x.order_status == "Sent");
        setLength6(L5.length);
      }
      setOpen(true);
      setSuccess(true);
    }
  };


  const exportPDF = async (order) => {

    let orderItemsArrayPDF = [];

    let justAnArray = [];

    const res = await axiosInstance.post(
      "/customerOrders/fetchOrderByID/" + order,
      { token: user.data.token }
    );

    const res1 = await axiosInstance.post('/retailer/fetch', {
      token: user.data.token,
      id: res.data.data[0]['retailer_id']
    })


    var retailerObject = res1.data.data[0]



    let orderItemsArray = [];
    for (let m of res.data.data[0]["order_items"]) {
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

    for (let m of res.data.data[0]["order_items"]) {
      if (m.item_name == "suit") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "jacket " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
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
            repeatOrder: res.data.data[0]["repeatOrder"],
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
            repeatOrder: res.data.data[0]["repeatOrder"],
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

    for (let m of res.data.data[0]["order_items"]) {
      if (m.item_name == "suit") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {

          let itemsObject1 = {
             item_name: m["item_name"],
             item_code: "jacket " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Suitmeasurements['jacket'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize["jacket"]
               ),
           };

           let itemsObject2 = {
             item_name: m["item_name"],
             item_code: "pant " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Suitmeasurements['pant'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize["pant"]
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
            measurementsObject: res.data.data[0].measurements[m["item_name"]],
            manualSize:
              res.data.data[0].manualSize == null ? (
                <></>
              ) : (
                res.data.data[0].manualSize[m["item_name"]]
              ),
          };
          singleOrderArray.push(itemsObject);
        }
      }
    }

console.log("single order : ", singleOrderArray)
    let htmlElement = (
      <>
        <div className="view-order-contents">
          {orderItemsArrayPDF.map((sub, index) => {
            let marginBottomVar = 70 - index * 25 + "px";

            if (index == orderItemsArrayPDF.length - 1) {
              var variableLength = 5 - sub.length;
            }
            var dummyElements = [];
            for (let i = 1; i <= variableLength; i++) {
              dummyElements.push(i);
            }
            return (
              <div
                key={index}
                className="view-order-top-contents"
                style={{ paddingTop: "0", marginBottom: marginBottomVar }}
              >
                <h3
                  style={{
                    paddingBottom: "5px",
                    textAlign: "center",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    width: "100%",
                    margin: 0
                  }}
                >
                  Siam Suits Supply {index + 1}
                </h3>
                {/* <div className="order-header" style={{ padding: "0" }} >
                  <div className="person-details" style={{ padding: "0", display:"flex", flexDirection:"row"}}>
                    <div
                      className="details-group"
                      style={{ border: "0", paddingLeft: "0px" }}
                    >
                      <ul style={{ paddingLeft: "0px" }}>
                        <li style={{ border: "0" }}>
                          <span style={{ fontSize: "10px" }}>
                            Customer Name: {res.data.data[0].customerName}
                          </span>

                        </li>
                        <li style={{ border: "0" }}>
                          <span style={{ fontSize: "10px", lineHeight: "0" }}>
                            Order Date: {res.data.data[0].OrderDate}
                          </span>
                        </li>
                        <li
                          style={{
                            border: "0",
                            textAlign: "right",
                            justifyContent: "end",
                            marginTop: "-10px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              lineHeight: "0",
                              textAlign: "right",
                            }}
                          >
                            Male(malethai)
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="person-identity" style={{ border: "0px" }}>
                      <h2 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                        <u>{res.data.data[0].orderId}</u>
                      </h2>
                    </div>
                    <div className="person-identity" style={{ border: "0px" }}>
                    <span style={{ fontSize: "10px" }}>
                            Customer Profile: <img width="25" height="25" src={PicBaseUrl + res.data.data[0]['customer_id']['image']} alt="" />
                          </span>

                    </div>
                    <div className="person-upi-code" style={{ border: "0px" }}>
                      <p style={{ fontSize: "10px", lineHeight: "0" }}>
                        Repeat Order:{" "}
                        <span style={{ textTransform: "capitalize" }}>
                          {res.data.data[0].repeatOrder == true ? "Yes" : "No"}
                        </span>
                      </p>
                      <img
                        src={PicBaseUrl + retailerObject['retailer_logo']}
                        className="img-fit"
                        style={{
                          width: "30%",
                          margin: "10px auto",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  </div>
                </div> */}
                <div className="top-header"style={{border: '1px solid black', padding: '5px'}}>
                 <div className="order-id" style={{display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <p style={{fontSize:'10px'}}>{res.data.data[0].orderId}</p>
                 </div> 
                <div className="top-list-data" style={{display:'flex', alignItems:'center', justifyContent:'space-between', columnGap: '20px', rowGap:'20px'}}>
                  <div className="info">
                    <p style={{fontSize:'9px'}}>Customer Name : {res.data.data[0].customerName}</p>
                    <p style={{fontSize:'9px'}}>Order Date : {res.data.data[0].OrderDate}</p>
                    <p style={{fontSize:'9px'}}>Repeat Order : {res.data.data[0].repeatOrder == true ? "Yes" : "No"}</p>
                  </div>
                  <div className="info" style={{display: 'flex', alignItems:'center', columnGap: '20px'}}>
                    <p style={{fontSize:'9px'}}>Customer Profile : </p>
                    <img src={PicBaseUrl + res.data.data[0]['customer_id']['image']} style={{width: '30px', height: '30px'}}/>
                  </div>
                  <div className="info" style={{display: 'flex', alignItems:'center', columnGap: '10px'}}>
                    <img src={PicBaseUrl + retailerObject['retailer_logo']} style={{width: '50px', height: '50px'}}/>
                  </div>

                 </div>
                  </div>
                <div
                  className="product-details"
                  style={{
                    border: "0",
                    paddingTop: "0",
                    paddingRight: "0",
                    paddingLeft: "0",
                  }}
                >
                  <div className="details-table" style={{ border: "0" }}>
                    <div className="tableData">
                      <table
                        key={index}
                        style={{
                          borderCollapse: "collapse",
                          borderSpacing: "0",
                          pageBreakAfter: "always",
                          height: "100%",
                        }}
                      >
                        <tbody>
                          {sub.map((singles, i) => {
                            return (
                              <tr key={i}>
                                <td
                                  style={{
                                    borderLeft: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    textAlign: "center",
                                    backgroundColor: "white",
                                    padding: "0",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      lineHeight: "0",
                                    }}
                                  >
                                    {singles.item_name.charAt(0).toUpperCase() + singles.item_name.slice(1)}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    textAlign: "center",
                                    backgroundColor: "white",
                                    padding: "0",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      lineHeight: "0",
                                    }}
                                  >
                                    {singles.item_code.charAt(0).toUpperCase() + singles.item_code.slice(1)}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    textAlign: "center",
                                    backgroundColor: "white",
                                    padding: "0",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      lineHeight: "0",
                                    }}
                                  >{`(${singles.styles.fabric_code})`}</span>
                                </td>
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    textAlign: "center",
                                    backgroundColor: "white",
                                    padding: "5px",
                                  }}
                                >
                                  <img
                                    src={mainQR}
                                    className="img-fit"
                                    width="60"
                                    height="60"
                                    // style={{ width: "40%" }}
                                  />
                                </td>
                              </tr>
                            );
                          })}

                          {dummyElements.length > 0 ? (
                            dummyElements.map((element, i) => {
                              return (
                                <tr key={i}>
                                  <td
                                    style={{
                                      borderLeft: "1px solid #ffffff",
                                      borderRight: "1px solid #ffffff",
                                      borderBottom: "1px solid #ffffff",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      padding: "0",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    ></span>
                                  </td>
                                  <td
                                    style={{
                                      borderRight: "1px solid #ffffff",
                                      borderBottom: "1px solid #ffffff",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      padding: "0",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    ></span>
                                  </td>
                                  <td
                                    style={{
                                      borderRight: "1px solid #ffffff",
                                      borderBottom: "1px solid #ffffff",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      padding: "0",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    ></span>
                                  </td>
                                  <td
                                    style={{
                                      borderRight: "1px solid #ffffff",
                                      borderBottom: "1px solid #ffffff",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      padding: "5px",
                                    }}
                                  >
                                    {" "}
                                    <span
                                      style={{
                                        display: "block",
                                        minHeight: "75px",
                                      }}
                                    ></span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <></>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {singleOrderArray.map((orderItem, i) => {
            return (
              <>
                <div
                  key={i}
                  className="view-order-top-contents"
                  style={{ paddingTop: "10px" }}
                >
                  <h3
                    style={{
                      paddingBottom: "5px",
                      textAlign: "center",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      width: "100%",
                      margin: 0
                    }}
                  >
                    Siam Suits Supply
                  </h3>
                  <div
                    className="order-header"
                    style={{ paddingLeft: "0px", paddingBottom: "0" }}
                  >
                    <div className="person-details" style={{ padding: "0px" }}>
                      <div
                        className="details-group"
                        style={{ border: "0px", paddingLeft: "0px" }}
                      >
                        <ul style={{ paddingLeft: "0px" }}>
                          <li style={{ border: "0px", display: "flex" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Name:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                {res.data.data[0].customerName}
                              </span>{" "}
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Order Date:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                {res.data.data[0].orderDate}
                              </span>
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              QTY:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                1 OF 2
                              </span>
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Old Order:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                No Oreders
                              </span>
                            </h4>
                          </li>
                          <li
                            style={{
                              border: "0",
                              textAlign: "right",
                              justifyContent: "end",
                              marginTop: "-10px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                lineHeight: "0",
                                textAlign: "right",
                              }}
                            >
                              Male(malethai)
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div
                        className="person-identity"
                        style={{ border: "0px" }}
                      >
                        <h2
                          style={{
                            fontSize: "10px",
                            lineHeight: "0",
                            border: "1px solid #333",
                            padding: "20px 35px",
                            margin: 0,
                            display: "inline-block",
                          }}
                        >
                          <u>{res.data.data[0].orderId}</u>
                        </h2>
                        <p
                          style={{
                            fontSize: "10px",
                            lineHeight: "0",
                            textTransform: "uppercase",
                            textAlign: "center",
                          }}
                        >
                          <strong>{orderItem.item_code}</strong>
                        </p>
                        {/* <div
                          style={{
                            position: "absolute",
                            top: "10px",
                            right: "30px",
                          }}
                        >
                          {singleOrderArray.map((itemNum, i) => {
                            return (
                              <p
                                key={i}
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "1.1",
                                  margin: 0,
                                  textAlign: "left",
                                }}
                              >
                                {itemNum.item_code}
                              </p>
                            );
                          })}
                        </div> */}
                      </div>
                      <div
                        className="person-upi-code"
                        style={{
                          border: "0px",
                          textAlign: "center",
                          justifyContent: "center",
                          alignItems: "flex-start",
                        }}
                      >
                        <img
                          src={mainQR}
                          className="img-fit"
                          style={{ width: "30%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className="mesurement-info"
                    style={{
                      border: "0",
                      paddingTop: "0",
                      paddingRight: "0",
                      paddingLeft: "0",
                      height: "490px",
                    }}
                  >
                    <div className="info-col-5">
                      <div className="info-table" style={{ border: "0" }}>
                        <table
                          style={{
                            border: "1px solid #333",
                            borderTop: "0",
                            borderRight: "0",
                            borderBottom: "0",
                            borderCollapse: "collapse",
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          <thead>
                            <tr style={{ padding: "0" }}>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  padding: "0",
                                }}
                              ></th>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  padding: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "9px",
                                    display: "block",
                                    padding: "0",
                                    borderBottom: "1px solid #000",
                                    lineHeight: "14px",
                                  }}
                                >
                                  Skin
                                </span>
                                <p
                                  style={{
                                    fontSize: "9px",
                                    padding: "0",
                                    lineHeight: "0px",
                                    display: "inline-block",
                                  }}
                                >
                                  thai
                                </p>
                              </th>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  padding: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "9px",
                                    display: "block",
                                    padding: "0",
                                    borderBottom: "1px solid #000",
                                    lineHeight: "14px",
                                  }}
                                >
                                  Fit
                                </span>
                                <p
                                  style={{
                                    fontSize: "9px",
                                    padding: "0",
                                    lineHeight: "0px",
                                    display: "inline-block",
                                  }}
                                >
                                  thai
                                </p>
                              </th>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  padding: "0",
                                  verticalAlign: "middle",
                                  borderLeft: "1px solid #333",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "9px",
                                    display: "block",
                                    padding: "0",
                                    borderBottom: "1px solid #000",
                                    lineHeight: "14px",
                                  }}
                                >
                                  TTL
                                </span>
                                <p
                                  style={{
                                    fontSize: "9px",
                                    padding: "0",
                                    lineHeight: "0px",
                                    display: "inline-block",
                                  }}
                                >
                                  thai
                                </p>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(
                              orderItem.measurementsObject.measurements
                            ).map((measurement, i) => {
                              return (
                                <tr key={i}>
                                  <th
                                    style={{
                                      borderRight: "1px solid #333",
                                      borderLeft: "1px solid #333",
                                      borderBottom: "1px solid #333",
                                      textAlign: "left",
                                      backgroundColor: "white",
                                      paddingLeft: "0.25rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    >
                                      {measurement}
                                    </span>
                                  </th>
                                  <td
                                    style={{
                                      borderRight: "1px solid #333",
                                      borderBottom: "1px solid #333",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      paddingLeft: "0.25rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    >
                                      {
                                        orderItem.measurementsObject
                                          .measurements[measurement].value
                                      }
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      borderRight: "1px solid #333",
                                      borderBottom: "1px solid #333",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      paddingLeft: "0.25rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    >
                                      {
                                        orderItem.measurementsObject
                                          .measurements[measurement]
                                          .adjustment_value
                                      }
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      borderRight: "1px solid #333",
                                      borderBottom: "1px solid #333",
                                      textAlign: "center",
                                      backgroundColor: "white",
                                      paddingLeft: "0.25rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        lineHeight: "0",
                                      }}
                                    >
                                      {
                                        orderItem.measurementsObject
                                          .measurements[measurement].total_value
                                      }
                                    </span>
                                    {orderItem.measurementsObject.measurements[
                                      measurement
                                    ].repeat == true ? (
                                      "  *"
                                    ) : (
                                      <></>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="info-col-7">
                      <div className="manual-info">
                        <h2
                          style={{
                            fontSize: "10px",
                            padding: "0.45rem",
                            color: "#000",
                            background: "#fff",
                            margin: 0
                          }}
                        >
                          Manual Size:
                        </h2>
                        <div className="img-box" style={{ height: "240px" }}>

                         { orderItem.item_name == 'suit'
                         ?
                         <img
                         src={orderItem.manualSize && orderItem.manualSize[orderItem['item_code'].split(" ")[0]] && orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
                           ?
                           PicBaseUrl + orderItem.manualSize[orderItem['item_code'].split(" ")[0]].imagePic
                           :
                           PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
                        }
                        className="img-fit"
                        style={{ width: "440px" }}
                        />
                        :
                        <img
                        src={orderItem.manualSize && orderItem.manualSize.imagePic
                          ?
                          PicBaseUrl + orderItem.manualSize.imagePic
                          :
                          PicBaseUrl3 + "images/manual/" + orderItem.item_code.split(" ")[0].toLowerCase() + "_manual.png"
                        }
                        className="img-fit"
                        style={{ width: "440px" }}
                      />
                        }
                       
                        </div>
                      </div>
                      <div
                        className="mesurement-note"
                        style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
                      >
                        <h2
                          style={{
                            fontSize: "10px",
                            paddingBottom: "0.1rem",
                            backgroundColor: "white",
                            color: "#000",
                            wordSpacing: "0",
                            borderRight: "1px solid #333",
                            textAlign: "center",
                            width:'160px',
                            margin: 0
                          }}
                        >
                          <strong>Measurement Note</strong>
                        </h2>
                        <p
                          style={{
                            fontSize: "10px",
                            paddingLeft: "0",
                            paddingTop: "0.5rem",
                            textAlign: "center",
                          }}
                        >
                          {orderItem.measurementsObject.notes}
                        </p>
                      </div>
                      {
                        orderItem['measurementsObject']['shoulder_type']
                        ?
                        <div
                          className="mesurement-note"
                          style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px', overflow: "hidden" }}
                        >
                        <h2
                          style={{
                            fontSize: "10px",
                            paddingBottom: "0.1rem",
                            backgroundColor: "white",
                            color: "#000",
                            wordSpacing: "0",
                            borderRight: "1px solid #333",
                            textAlign: "center",
                            width:'160px',
                            margin: 0
                          }}
                        >
                          <strong>Shoulder type</strong>
                        </h2>
                        <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['shoulder_type'][0].toUpperCase() + orderItem['measurementsObject']['shoulder_type'].slice(1)}</p>
                        <img style={{padding:'8px', height:"50px", width:'50px', filter: "drop-shadow(-5px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/jacket/" + orderItem['measurementsObject']['shoulder_type'] + ".png"} alt="" />
                      </div>
                      :
                      orderItem['measurementsObject']['pant_type']
                      ?

                      <div
                        className="mesurement-note"
                        style={{ border: "1px solid #333", marginLeft: "30px", display: "flex", columnGap:'20px' }}
                      >
                        <h2
                          style={{
                            fontSize: "10px",
                            paddingBottom: "0.1rem",
                            backgroundColor: "white",
                            color: "#000",
                            wordSpacing: "0",
                            borderRight: "1px solid #333",
                            textAlign: "center",
                            width:'160px',
                            margin: 0
                          }}
                        >
                          <strong>Pants type</strong>
                        </h2>
                        <p style={{fontSize: "10px"}}>{orderItem['measurementsObject']['pant_type'][0].toUpperCase() + orderItem['measurementsObject']['pant_type'].slice(1)}</p>
                        <img style={{padding:'8px', height:"50px", width:'50px', filter: "drop-shadow(0px 0 1px red)",position:"relative", left: "10px"}} src={"/ImagesFabric/pants/" + orderItem['measurementsObject']['pant_type'] + ".png"} alt="" />
                      </div>

                      :
                      <></>
                      
                      }
                     
                    </div>
                  </div>
                </div>
                <div className="product-styling" style={{ height: "580px" }}>
                  <h3
                    style={{
                      paddingBottom: "5px",
                      textAlign: "center",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      width: "100%",
                      margin: 0
                    }}
                  >
                    Siam Suits Supply
                  </h3>
                  <div
                    className="order-header"
                    style={{ paddingLeft: "0px", paddingBottom: "0" }}
                  >
                    <div className="person-details" style={{ padding: "0px" }}>
                      <div
                        className="details-group"
                        style={{ border: "0px", paddingLeft: "0px" }}
                      >
                        <ul style={{ paddingLeft: "0px" }}>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Name:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                {res.data.data[0].customerName}
                              </span>
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Order Date:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                {res.data.data[0].orderDate}
                              </span>
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              QTY:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                1 OF 2
                              </span>
                            </h4>
                          </li>
                          <li style={{ border: "0px" }}>
                            <h4 style={{ fontSize: "10px", lineHeight: "0", margin: 0 }}>
                              Old Order:{" "}
                              <span
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "0",
                                  textTransform: "capitalize",
                                  wordSpacing: "-2px",
                                  paddingLeft: "3px",
                                  letterSpacing: "0px",
                                }}
                              >
                                No Orders
                              </span>
                            </h4>
                          </li>
                          <li
                            style={{
                              border: "0",
                              textAlign: "right",
                              justifyContent: "end",
                              marginTop: "-10px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                lineHeight: "0",
                                textAlign: "right",
                              }}
                            >
                              Male(malethai)
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div
                        className="person-identity"
                        style={{ border: "0px" }}
                      >
                        <h2
                          style={{
                            fontSize: "10px",
                            lineHeight: "0",
                            border: "1px solid #333",
                            padding: "20px 35px",
                            display: "inline-block",
                            margin: 0
                          }}
                        >
                          <u>{res.data.data[0].orderId}</u>
                        </h2>
                        <p
                          style={{
                            fontSize: "10px",
                            lineHeight: "0",
                            textTransform: "uppercase",
                            textAlign: "center",
                          }}
                        >
                          <strong>{orderItem.item_code}</strong>
                        </p>
                      </div>
                      <div
                        className="person-upi-code"
                        style={{
                          border: "0px",
                          textAlign: "center",
                          justifyContent: "center",
                          alignItems: "flex-start",
                        }}
                      >
                        <img
                          src={mainQR}
                          className="img-fit"
                          style={{ width: "30%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className="product-final-views"
                    style={{
                      padding: "0",
                      paddingTop: "15px",
                      paddingBottom: "10px",
                      marginBottom: "20px",
                      border: "0",
                      lineHeight: "0",
                      height: "auto",
                    }}
                  >
                    <div
                      className="product-views"
                      style={{
                        padding: "0",
                        border: "1px solid #333",
                        lineHeight: "0",
                        height: "auto",
                      }}
                    >
                      <div className="info-col-12">
                        <div
                          className="view-lists"
                          style={{
                            width: "100%",
                            padding: "0",
                            border: "0",
                            lineHeight: "0",
                          }}
                        >
                          <table
                            style={{
                              border: "0",
                              borderCollapse: "collapse",
                              padding: "0",
                              width: "100%",
                            }}
                          >
                            <thead>
                              <tr style={{ paddingTop: "1.5rem" }}>
                                {orderItem.item_name == "suit" &&
                                  orderItem.item_code.split(" ")[0] == "jacket"
                                  ? Object.keys(
                                    orderItem["styles"]["jacket"]["style"]
                                  ).map((data, i) => {
                                    return (
                                      <th
                                        key={i}
                                        style={{
                                          border: "0",
                                          backgroundColor: "white",
                                          color: "#000",
                                          textAlign: "center",
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "8px",
                                            lineHeight: "10px",
                                          }}
                                        >
                                          {data}
                                        </span>
                                      </th>
                                    );
                                  })
                                  : orderItem.item_name == "suit" &&
                                    orderItem.item_code.split(" ")[0] == "pant"
                                    ? Object.keys(
                                      orderItem["styles"]["pant"]["style"]
                                    ).map((data, i) => {
                                      return (
                                        <th
                                          key={i}
                                          style={{
                                            border: "0",
                                            backgroundColor: "white",
                                            color: "#000",
                                            textAlign: "center",
                                            textTransform: "capitalize",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "8px",
                                              lineHeight: "10px",
                                            }}
                                          >
                                            {data}
                                          </span>
                                        </th>
                                      );
                                    })
                                    : Object.keys(orderItem.styles.style).map(
                                      (data, i) => {
                                        return (
                                          <th
                                            key={i}
                                            style={{
                                              border: "0",
                                              backgroundColor: "white",
                                              color: "#000",
                                              textAlign: "center",
                                              textTransform: "capitalize",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: "8px",
                                                lineHeight: "10px",
                                              }}
                                            >
                                              {data}
                                            </span>
                                          </th>
                                        );
                                      }
                                    )}
                              </tr>
                            </thead>
                            <tbody>
                              {orderItem.item_name == "suit" &&
                                orderItem.item_code.split(" ")[0] == "jacket"
                                ? Object.keys(
                                  orderItem["styles"]["jacket"]["style"]
                                ).map((data, i) => {
                                  return (
                                    <td
                                      key={i}
                                      align="center"
                                      style={{
                                        backgroundColor: "white",
                                        color: "#000",
                                        textAlign: "center",
                                        padding: "0",
                                      }}
                                    >
                                      <div
                                        className="img-box"
                                        style={{
                                          lineHeight: "0",
                                          padding: "0",
                                        }}
                                      >
                                        <img
                                          src={
                                            PicBaseUrl +
                                            orderItem["styles"]["jacket"]["style"][data][
                                            "image"
                                            ]
                                          }
                                          className="img-fit"
                                          style={{
                                            width: "50px",
                                            height: "50px",
                                            margin: "0",
                                            padding: "0",
                                          }}
                                        />
                                      </div>
                                      <p
                                        style={{
                                          fontSize: "8px",
                                          lineHeight: "0",
                                          textAlign: "center",
                                        }}
                                      >
                                        {
                                          orderItem["styles"]["jacket"]["style"][data][
                                          "value"
                                          ]
                                        }
                                      </p>
                                    </td>
                                  );
                                })
                                : orderItem.item_name == "suit" &&
                                  orderItem.item_code.split(" ")[0] == "pant"
                                  ? Object.keys(orderItem["styles"]["pant"]["style"]).map(
                                    (data, i) => {
                                      return (
                                        <td
                                          key={i}
                                          align="center"
                                          style={{
                                            backgroundColor: "white",
                                            color: "#000",
                                            textAlign: "center",
                                            padding: "0",
                                          }}
                                        >
                                          <div
                                            className="img-box"
                                            style={{
                                              lineHeight: "0",
                                              padding: "0",
                                            }}
                                          >
                                            <img
                                              src={
                                                PicBaseUrl +
                                                orderItem["styles"]["pant"]["style"][data][
                                                "image"
                                                ]
                                              }
                                              className="img-fit"
                                              style={{
                                                width: "50px",
                                                height: "50px",
                                                margin: "0",
                                                padding: "0",
                                              }}
                                            />
                                          </div>
                                          <p
                                            style={{
                                              fontSize: "8px",
                                              lineHeight: "0",
                                              textAlign: "center",
                                            }}
                                          >
                                            {
                                              orderItem["styles"]["pant"]["style"][data][
                                              "value"
                                              ]
                                            }
                                          </p>
                                        </td>
                                      );
                                    }
                                  )
                                  : Object.keys(orderItem.styles.style).map(
                                    (data, i) => {
                                      return (
                                        <td
                                          key={i}
                                          align="center"
                                          style={{
                                            backgroundColor: "white",
                                            color: "#000",
                                            textAlign: "center",
                                            padding: "0",
                                          }}
                                        >
                                          <div
                                            className="img-box"
                                            style={{
                                              lineHeight: "0",
                                              padding: "0",
                                            }}
                                          >
                                            <img
                                              src={
                                                PicBaseUrl +
                                                orderItem.styles.style[data][
                                                "image"
                                                ]
                                              }
                                              className="img-fit"
                                              style={{
                                                width: "50px",
                                                height: "50px",
                                                margin: "0",
                                                padding: "0",
                                              }}
                                            />
                                          </div>
                                          <p
                                            style={{
                                              fontSize: "8px",
                                              lineHeight: "0",
                                              textAlign: "center",
                                            }}
                                          >
                                            {
                                              orderItem.styles.style[data][
                                              "value"
                                              ]
                                            }
                                          </p>
                                        </td>
                                      );
                                    }
                                  )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="monogram-views"
                    style={{ border: "0", paddingTop: "10px", margin: "0" }}
                  >
                    <div className="info-col-5">
                      { orderItem.item_code.split(" ")[0] == "pant" ?
                      <></>
                      :
                      <div
                        className="monogram-table"
                        style={{ width: "100%", border: "0", padding: "0" }}
                      >
                        <table
                          width="100%"
                          style={{
                            width: "100%",
                            border: "1px solid #333",
                            borderRight: "0",
                            borderBottom: "0",
                            borderTop: "0",
                            borderCollapse: "collapse",
                          }}
                        >
                          <thead>
                            <tr style={{ padding: "0.35rem 0 0.55rem 0" }}>
                              <th
                                colSpan="2"
                                align="center"
                                style={{
                                  borderTop: "1px solid #333",
                                  borderRight: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span style={{ fontSize: "10px" }}>
                                  Monogram
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  Position
                                </span>
                              </th>
                              <td
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  padding: "0.35rem 0 0.45rem 0",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  {orderItem.item_name == "suit" &&
                                    orderItem.item_code.split(" ")[0] ==
                                    "jacket" &&
                                    orderItem["styles"]["jacket"]["monogram"] !==
                                    undefined
                                    ? orderItem["styles"]["jacket"]["monogram"][
                                    "side"
                                    ]
                                    : orderItem["styles"]["monogram"] !==
                                      undefined
                                      ? orderItem["styles"]["monogram"]["side"]
                                      : ""}
                                </span>
                              </td>
                            </tr>
                            <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  Style
                                </span>
                              </th>
                              <td
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  {orderItem.item_name == "suit" &&
                                    orderItem.item_code.split(" ")[0] ==
                                    "jacket" &&
                                    orderItem["styles"]["jacket"]["monogram"] !==
                                    undefined
                                    ? orderItem["styles"]["jacket"]["monogram"][
                                    "font"
                                    ]
                                    : orderItem["styles"]["monogram"] !==
                                      undefined
                                      ? orderItem["styles"]["monogram"]["font"]
                                      : ""}
                                </span>
                              </td>
                            </tr>
                            <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
                              <th
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  Font Color
                                </span>
                              </th>
                              <td
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  {orderItem.item_name == "suit" &&
                                    orderItem.item_code.split(" ")[0] ==
                                    "jacket" &&
                                    orderItem["styles"]["jacket"]["monogram"] !==
                                    undefined
                                    ? orderItem["styles"]["jacket"]["monogram"][
                                    "color"
                                    ]
                                    : orderItem["styles"]["monogram"] !==
                                      undefined
                                      ? orderItem["styles"]["monogram"]["color"]
                                      : ""}
                                </span>
                              </td>
                            </tr>
                            <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
                              <td
                                colSpan="2"
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  Monogram Name :{" "}
                                  {orderItem.item_name == "suit" &&
                                    orderItem.item_code.split(" ")[0] ==
                                    "jacket" &&
                                    orderItem["styles"]["jacket"]["monogram"] !==
                                    undefined
                                    ? orderItem["styles"]["jacket"]["monogram"][
                                    "tag"
                                    ]
                                    : orderItem["styles"]["monogram"] !==
                                      undefined
                                      ? orderItem["styles"]["monogram"]["tag"]
                                      : ""}
                                </span>
                              </td>
                            </tr>
                            <tr style={{ padding: "0.35rem 0 0.45rem 0" }}>
                              <td
                                colSpan="2"
                                style={{
                                  borderRight: "1px solid #333",
                                  borderBottom: "1px solid #333",
                                  borderLeft: "1px solid #333",
                                  backgroundColor: "white",
                                  color: "#000",
                                  textAlign: "center",
                                  lineHeight: "0",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{ fontSize: "10px", lineHeight: "0" }}
                                >
                                  Optional:
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div> }
                     
                    </div>
                    <div className="info-col-7">
                    <div
                        className="manual-views-table"
                        style={{ border: "0", marginLeft: "30px" }}
                      >
                        <table
                          style={{
                            border: "1px solid #333",
                            borderRight: "0",
                            borderBottom: "0",
                            borderTop: "0",
                            borderCollapse: "collapse",
                          }}
                        >
                          <thead>
                            <tr style={{ padding: "0.5rem " }}>
                              {orderItem.styles.fabric_code !== undefined ? (
                                <th
                                  style={{
                                    borderTop: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    Fabric
                                  </span>
                                </th>
                              ) : (
                                <></>
                              )}
                              {orderItem.item_name == "suit" &&
                                orderItem.item_code.split(" ")[0] == "jacket" &&
                                orderItem.styles.jacket.lining_code !==
                                undefined ? (
                                <th
                                  style={{
                                    borderTop: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    Lining
                                  </span>
                                </th>
                              ) : orderItem.styles.lining_code !== undefined ? (
                                <th
                                  style={{
                                    borderTop: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    Lining
                                  </span>
                                </th>
                              ) : (
                                <></>
                              )}
                              {orderItem.item_name == "suit" &&
                                orderItem.item_code.split(" ")[0] == "jacket" &&
                                orderItem.styles.jacket.piping !== undefined ? (
                                <th
                                  style={{
                                    borderTop: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    Piping
                                  </span>
                                </th>
                              ) : orderItem.styles.piping !== undefined ? (
                                <th
                                  style={{
                                    borderTop: "1px solid #333",
                                    borderRight: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    Piping
                                  </span>
                                </th>
                              ) : (
                                <></>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ padding: "0.1rem 0 0.5rem 0" }}>
                              {orderItem.styles.fabric_code !== undefined ? (
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    {orderItem.styles.fabric_code}
                                  </span>
                                </td>
                              ) : (
                                <></>
                              )}
                              {orderItem.item_name == "suit" &&
                                orderItem.item_code.split(" ")[0] == "jacket" &&
                                orderItem.styles.jacket.lining_code !==
                                undefined ? (
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    {orderItem.styles.jacket.lining_code}
                                  </span>
                                </td>
                              ): orderItem.styles.lining_code !== undefined ? (
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    {orderItem.styles.lining_code}
                                  </span>
                                </td>
                              ) : (
                                <></>
                              )}
                              {orderItem.item_name == "suit" &&
                                orderItem.item_code.split(" ")[0] == "jacket" &&
                                orderItem.styles.jacket.piping !== undefined ? (
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    {orderItem.styles.jacket.piping}
                                  </span>
                                </td>
                              ): orderItem.styles.piping !== undefined ? (
                                <td
                                  style={{
                                    borderRight: "1px solid #333",
                                    borderBottom: "1px solid #333",
                                    borderLeft: "1px solid #333",
                                    backgroundColor: "white",
                                    color: "#000",
                                    textAlign: "center",
                                    lineHeight: "4px",
                                  }}
                                >
                                  <span style={{ fontSize: "10px" }}>
                                    {orderItem.styles.piping}
                                  </span>
                                </td>
                              ) : (
                                <></>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div
                        className="notes"
                        style={{
                          paddingTop: "10px",
                          height: "100px",
                          marginLeft: "30px",
                        }}
                      >
                        <div
                          className="mesurement-note"
                          style={{ border: "1px solid #333", height: "70px" }}
                        >
                          <h2
                            style={{
                              fontSize: "10px",
                              paddingBottom: "0.25rem",
                              backgroundColor: "white",
                              color: "#000",
                              wordSpacing: "0",
                              borderBottom: "1px solid #333",
                              textAlign: "center",
                              margin: 0
                            }}
                          >
                            Styling Notes:
                          </h2>
                          <p
                            style={{
                              fontSize: "10px",
                              paddingLeft: "0",
                              paddingTop: "0.25rem",
                              textAlign: "center",
                            }}
                          >
                            {orderItem.styles.note}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })}
          <div>
            <img src={PicBaseUrl + res.data.data[0]['customer_id']['image']} style={{maxWidth: '640px', maxHeight: '480px', display:'block', margin:'auto', paddingTop:'70px'}}/>
          </div>
        </div>
      </>
    );
    let elementAsString = renderToString(htmlElement);
    let doc = new jsPDF("l", "px", [595, 842]);
    doc.html(elementAsString, {
      async callback(doc) {
        window.open(doc.output("bloburl"), "_blank");
      }
    });
  };


  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };

  // handle on click show order items details-------------------------

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

  const fetchRetailer = async() => {
    const res = await axiosInstance('/retailer/fetch', {
      token: user.data.token,
      _id: retailer
    })

    return res.data.data[0]


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
              <p>Customer Name</p>
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
                {retailers.length > 0 && retailers !== null ? (
                  retailers.map((data, i) => (
                    <option key={i} value={data.retailer_name}>
                      {data.retailer_name.charAt(0).toUpperCase() +
                        data.retailer_name.slice(1)}
                    </option>
                  ))
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
          </div>
        </div>
        <div className="order-table">
          <div className="order-top-tabs filterbutton">
            <div className="multipleChange-first">
              <p>
                {" "}
                <strong> New Order </strong>{" "}
              </p>
              <ul>
                <li>
                  {" "}
                  <Link to="/order/newOrder" className="active">
                    {" "}
                    New Orders <span>({l1})</span>{" "}
                  </Link>{" "}
                </li>
                <li>
                  {" "}
                  <Link to="/order/rushOrder" id="rushorder">
                    {" "}
                    Rush Orders <span>({l3})</span>{" "}
                  </Link>{" "}
                </li>
                <li>
                  {" "}
                  <Link to="/order/modified">
                    {" "}
                    Modified <span>({l2})</span>{" "}
                  </Link>{" "}
                </li>
                <li>
                  {" "}
                  <Link to="/order/processing">
                    {" "}
                    Processing <span>({l4})</span>{" "}
                  </Link>{" "}
                </li>
                <li>
                  {" "}
                  <Link to="/order/readyforShipping">
                    {" "}
                    Ready for Shipment <span>({l5})</span>{" "}
                  </Link>{" "}
                </li>
                <li>
                  {" "}
                  <Link to="/order/sent">
                    {" "}
                    Sent <span>({l6})</span>{" "}
                  </Link>{" "}
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
                    onChange={handleStatusChange}
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
                <th>CUST NAME</th>
                <th>Order Date</th>
                <th>QTY</th>
                <th>VIEW/Edit</th>
                <th>Pattern PDF</th>
                <th>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {orders !== null && orders.length > 0 ? (
                orders.map((order, i) => {
                  if (order.order_status === "New Order") {
                    return (
                      <tr key={i}>
                        <th>
                          <input
                            type="checkbox"
                            value={order._id}
                            onChange={handleId}
                          />
                        </th>
                        <td>
                          <strong>{i + 1 + index}</strong>
                        </td>
                        {/* <td>{order.retailerName ? order.retailerName.charAt(0).toUpperCase() + order.retailerName.slice(1) : ""}</td> */}
                        <td>{order.orderId}</td>
                        <td>{order.customerName ? order.customerName.charAt(0).toUpperCase() + order.customerName.slice(1) : ""}</td>
                        <td>{order.OrderDate}</td>
                        <td className="orderQuantity">
                          <span 
                            // onMouseEnter = {(e) => handleShowOrderItemsDetails(e, order._id)}
                            onClick = {(e) => handleShowOrderItemsDetails(e, order._id)}
                            // onClick = {(e) => handleShowFabricDetails(e, order._id)}
                          >
                            {order.total_quantity}
                          </span>
                        </td>
                        <td>
                          <strong>
                            <button
                              onClick={() => exportPDF(order._id)}
                              target="_blank"
                              rel="noreferrer"
                              className="action"
                            >
                              view
                            </button>
                          </strong>{" "}
                          |{" "}
                          <Link
                            to={`/admin/edit-Order/${order._id}`}
                            className="action"
                          >
                            Edit
                          </Link>
                        </td>
                        <td>
                          <strong>
                            <Link to="#" className="action">
                              Upload
                            </Link>
                          </strong>{" "}
                          | <a href="#">NA</a>
                        </td>
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
                      </tr>
                    );
                  }
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
    </main>
  );
}
