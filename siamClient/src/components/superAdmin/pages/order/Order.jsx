import React from "react";
import "./order.css";
// import "./pdfStyle.css";
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

export default function Order() {
  const { user } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState([]);
  // const [orderStatus, setOrderStatus] = useState("New Order");
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
  const [limit, setLimit] = useState(5);
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
  const [products, setProducts] = useState([]);
  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [showOrders, setShowOrders] = useState(false)
  const [showRetailers, setShowRetailers] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState("none");
  const [allCustomers, setAllCustomers] = useState([]);
  const [customerID, setCustomerID] = useState("");


  useEffect(() => {
    const par = {
      order_status: statusName
    }

    const count = {
      order_status: statusName
    }

    if (name1.length > 0) {
      par['retailerName'] = name1
      count['retailerName'] = name1
    }
    if (customerID.length > 0) {
      par['customer_id'] = customerID
      count['customer_id'] = customerID
    }
    if (d.length > 0) {
      par['OrderDate'] = d
      count['OrderDate'] = d
    }

    fetchPageOrders(par, count, (page - 1) * 5)

  }, [statusName, page]);

  useEffect(() => {
    const par = {}
    fetchRetailers();
    fetchAllOrders(par);
    fetchProducts();
  }, []);


  const count = Math.ceil(docLength / limit);

  const handleChangePage = (e, p) => {

    setIndex(limit * (p - 1));
    setPage(p);

  };


  const searchSelectChange = async (event) => {
    const { value } = event.target;
    setRetailer(value);
    name1 = value;
    setName1(value);
    // fetchData(1, limit, statusName, name, value.trim(), d);
  };


  const searchDateChange = async (event) => {
    const { value } = event.target;
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

    const count = {
      order_status: statusName
    }

    const parForTabs = {}


    if (name1.length > 0) {
      par['retailerName'] = name1
      count['retailerName'] = name1
      parForTabs['retailerName'] = name1
    }
    if (customerID.length > 0) {
      par['customer_id'] = customerID
      count['customer_id'] = customerID
      parForTabs['customer_id'] = customerID
    }
    if (d.length > 0) {
      par['OrderDate'] = d
      count['OrderDate'] = d
      parForTabs['OrderDate'] = d
    }


    setPage(1)
    fetchPageOrders(par, count, (1 - 1) * 5)
    fetchAllOrders(parForTabs)
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
      `/customerOrders/updateStatus/${id}`,
      statusChange
    );
    if (res) {
      const par = {
        order_status: statusName
      }

      const count = {
        order_status: statusName
      }

      const parForTabs = {}

      if (name1.length > 0) {
        par['retailerName'] = name1
        count['retailerName'] = name1
        parForTabs['retailerName'] = name1
      }
      if (customerID.length > 0) {
        par['customer_id'] = customerID
        count['customer_id'] = customerID
        parForTabs['customer_id'] = customerID
      }
      if (d.length > 0) {
        par['OrderDate'] = d
        count['OrderDate'] = d
        parForTabs['OrderDate'] = d
      }
      // fetchPageOrders(par, (page - 1) * 5)
      // fetchData(page, limit, statusName, name, name1, d);
      fetchAllOrders(parForTabs);
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
    // fetchData(page, limit, statusName, name, name1, d);
    // const par = {
    //   order_status: statusName
    // }

    // const count= {
    //   order_status: statusName
    // }

    // if(name1.length > 0){
    //   par['retailerName'] = name1
    //   count['retailerName'] = name1
    // }
    // if(customerID.length > 0){
    //   par['customer_id'] = customerID
    //   count['customer_id'] = customerID
    // }
    // if(d.length > 0){
    //   par['OrderDate'] = d
    //   count['OrderDate'] = name
    // }
    // fetchPageOrders(par, (page - 1) * 5)
  };

  const handleUpdateStatus = async (e, p) => {
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
        // fetchData(page, limit, statusName, name, name1, d);

        const par = {
          order_status: statusName
        }

        const count = {
          order_status: statusName
        }

        const parForTabs = {}
        if (name1.length > 0) {
          par['retailerName'] = name1
          count['retailerName'] = name1
          parForTabs['retailerName'] = name1
        }
        if (customerID.length > 0) {
          par['customer_id'] = customerID
          count['customer_id'] = customerID
          parForTabs['customer_id'] = customerID
        }
        if (d.length > 0) {
          par['OrderDate'] = d
          count['OrderDate'] = d
          parForTabs['OrderDate'] = d
        }
        // fetchPageOrders(par, (page - 1) * 5)

        // const par = {
        //   order_status: statusName
        // }
        // if(name1.length > 0){
        //   par['retailerName'] = name1
        // }
        // if(name.length > 0){
        //   par['customer_id'] = customerID
        // }
        // if(d.length > 0){
        //   par['OrderDate'] = d
        // }
        fetchPageOrders(par, count, (page - 1) * 5)

        fetchAllOrders(parForTabs);
        setCheckboxItem([])
      }
      setOpen(true);
      setSuccess(true);
    }
  };


  const handleOpenPdf = async (data) => {
    const res = await axiosInstance.post('customerOrders/checkPdf', {
      token: user.data.token,
      pdf: data
    })
    if (res.data.status == true) {
      const url = PicBaseUrl4 + "pdf/" + data;
      window.open(url);
    } else {
      setErrorMsg(res.data.message)
      setSuccess(false)
      setError(true)
    }
  }


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
    setPage(1)
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
    const sinOrder = orders.filter((order) => {
      return id == order._id;
    })
    setOrder(sinOrder[0])
    let string = "";
    for (let x of sinOrder[0]['order_items']) {
      if (string.length > 0) {
        string = string + ", " + x.quantity + " " + x.item_name
      } else {
        string = x.quantity + " " + x.item_name
      }
    }
    setOrderItemString(string)
    setAnchorEl(e.currentTarget);
  }


  const handleShowFabricDetails = () => {
    const styleFabricArray = [];
    for (let x of order['order_items']) {

      let ind = 1;
      for (let styles of Object.keys(x['styles'][0])) {
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

  const handleSelectCustomer = (e) => {
    setCustomerID(e.target.dataset.val)
    setShowCustomerList("none")
    setAllCustomers([])
  }

  const handleFetchCustomers = async (e) => {
    if (e.target.value.length > 2) {
      const res = await axiosInstance.post("/userMeasurement/fetchCustomerByLike/" + e.target.value, { token: user.data.token })
      if (res.data.data.length > 0) {
        setAllCustomers(res.data.data)
        setShowCustomerList("block")
      }
    }
    if (!e.target.value.length > 0) {
      setShowCustomerList("none")
      setAllCustomers([])
    }
  }






  // -----------------------------------------------------------------
  // static function--------------------------------------------------

  const fetchAllOrders = async (par) => {

    const res = await axiosInstance.post("/customerOrders/fetchAll", {
      token: user.data.token,
      par: par
    });

    if (res.data.status === true) {

      setDoc(res.data.data ? res.data.data.length : 0)

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

  };

  const fetchRetailers = async () => {
    const res = await axiosInstance.post("/retailer/fetchAll", {
      token: user.data.token,
    });
    if (res.data.status === true) {
      setShowRetailers(true)
      setRetailers(res.data.data);
    }
  };

  const fetchData = async (page, limit, status, name, name1, d) => {
    const res = await axiosInstance.post(
      `/customerOrders/fetchPaginate/?page=${page}&limit=${limit}&order_status=${status}&customerName=${name}&retailerName=${name1}&orderDate=${d}`,
      {
        token: user.data.token,
      }
    );

    if (res.data.status === true) {

      setDoc(res.data.meta.totalDocs);
      setOrders(res.data.data);
      setShowOrders(true)
    }
  };

  const fetchPageOrders = async (par, count, skip) => {
    const res = await axiosInstance.post("/customerOrders/fetchAdminPaginateNew/" + skip, {
      token: user.data.token,
      par: par,
      count: count
    })

    setDoc(res.data.docCount)

    if (res.data.status == true) {
      setShowOrders(true)
      setOrders(res.data.data)
    } else {
      setShowOrders(false)
      setOrders([])
    }
  }
  const fetchProducts = async () => {
    const res = await axiosInstance.post("/product/fetchAll/0/0", {
      token: user.data.token,
    });
    const productObject = {}
    for (let x of res.data.data) {
      const featureArray = []
      for (let y of x.features) {
        if (y.additional == false) {
          featureArray.push(y.name)
        }
      }
      productObject[x.name] = featureArray

    }
    setProductFeaturesObject(productObject)
    setProducts(res.data.data);
  };

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
            <div>
              <p>Customer Name</p>
              <input className="searchinput" type="text" onChange={handleFetchCustomers} />
              {/* <select name="" id="selectCustomer" onChange={handleSelectCustomer}>
              <option value="0">Select a Customer</option>
              {allCustomers.map((singleCustomer) => {
                return (
                  <option key={singleCustomer['_id']} value={singleCustomer['_id']}>{singleCustomer['firstname'] + " " + singleCustomer['lastname']}</option>
                )
              })}
            </select> */}


            </div>
            <div style={{ display: showCustomerList }} className="customer-list2">
              <ol>
                {allCustomers.map((singleCustomer) => {
                  return (
                    <li style={{ color: "green" }} key={singleCustomer['_id']} data-val={singleCustomer['_id']} onClick={handleSelectCustomer}>{singleCustomer['firstname'] + " " + singleCustomer['lastname']}</li>
                  )

                })}
              </ol>
            </div>
            {/* <div className="searchinput-inner">
              <p>Customer Name</p>
              <input
                type="text"
                className="searchinput"
                onChange={searchChange}
                placeholder="Jason Wills"
              />
            </div> */}
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
                {
                  showRetailers
                    // retailers.length > 0 && retailers !== null 
                    ? (
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
            <div>
              <span style={{ marginLeft: "10px" }}>
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
                  className={statusName == "New Order" ? "active" : ""}
                  data-name="New Order"
                  onClick={handleStatusChange}
                >
                  New Orders ({l1})
                </li>
                <li
                  className={statusName == "Rush" ? "active" : ""}
                  id="rushorder"
                  data-name="Rush"
                  onClick={handleStatusChange}
                >
                  Rush Orders ({l3})
                </li>
                <li
                  className={statusName == "Modified" ? "active" : ""}
                  data-name="Modified"
                  onClick={handleStatusChange}
                >
                  Modified ({l2})
                </li>
                <li
                  className={statusName == "Processing" ? "active" : ""}
                  data-name="Processing"
                  onClick={handleStatusChange}
                >
                  Processing ({l4})
                </li>
                <li
                  className={statusName == "Shipment" ? "active" : ""}
                  data-name="Shipment"
                  onClick={handleStatusChange}
                >
                  Ready for Shipment ({l5})
                </li>
                <li
                  className={statusName == "Sent" ? "active" : ""}
                  data-name="Sent"
                  onClick={handleStatusChange}
                >
                  Sent ({l6})
                </li>
              </ul>
            </div>
          </div>
          <div className="order-top-tabs filterbutton" style={{width: "100%", display: "flex", justifyContent: "right"}}>
            <div className="multipleChange-last" >
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
                <th>CUST NAME</th>
                <th> Type </th>
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
              {showOrders
                // orders !== null && orders.length > 0 
                ? (
                  orders.map((order, i) => {
                    // if (order.order_status === "New Order") {
                    return (
                      <tr key={order._id}>
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
                        <td>{order.customerName ? order.customerName.charAt(0).toUpperCase() + order.customerName.slice(1) : ""}</td>
                        <td> {order.type == "group" ?
                          <span className="ModifiedBg" style={{ textTransform: "capitalize" }}>
                            {order.type}
                          </span> :
                          <span className="newOrderBg" style={{ textTransform: "capitalize" }}>
                            Normal
                          </span>
                        } </td>
                        <td>{order.OrderDate}</td>
                        <td className="orderQuantity">
                          <span
                            // onMouseEnter = {(e) => handleShowOrderItemsDetails(e, order._id)}
                            onClick={(e) => handleShowOrderItemsDetails(e, order._id)}
                          // onClick = {(e) => handleShowFabricDetails(e, order._id)}
                          >
                            {order.total_quantity}
                          </span>
                        </td>
                        <td>
                          <strong>
                            <button
                              // onClick={() => exportPDF(order._id)}
                              // onClick={() => 
                              onClick={() => handleOpenPdf(order.orderId)}
                              target="_blank"
                              rel="noreferrer"
                              className="action"
                            >
                              view
                            </button>
                          </strong>

                          {statusName !== "Ready For Shipment" && statusName !== "Sent"
                            ?
                            <Link
                              to={`/admin/edit-Order/${order._id}`}
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
          <Typography sx={{ p: 2 }}>{orderItemString} <span><OpenInNewIcon onClick={handleShowFabricDetails} /></span></Typography>
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
            <div style={{ display: "flex" }}>
              Fabric Details for {order['orderId']}
              <div style={{ marginLeft: "auto" }}>
                <CloseIcon onClick={handleCloseFabricDialogOpen} />
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
