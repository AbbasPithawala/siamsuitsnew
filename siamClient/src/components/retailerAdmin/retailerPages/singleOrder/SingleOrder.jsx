import React, { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import { axiosInstance } from "../../../../config";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import RepeatIcon from "@mui/icons-material/Repeat";
import EditIcon from "@mui/icons-material/Edit";
import Tooltip from "@mui/material/Tooltip";
import "./SingleOrder.css";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { PicBaseUrl } from "../../../../imageBaseURL";


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function SingleOrder() {

  const location = useLocation();
  const path = location.pathname.split("/")[3];
  const { user } = useContext(Context);

  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setsuccessMsg] = useState("");
  const [error, setError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [customer, setCustomer] = useState({});
  const [orders, setOrders] = useState([]);  
  const [open, setOpen] = React.useState(false);
  const [orderType, setOrderType] = useState("normal")
  const [groupOrderID, setGroupOrderID] = useState("")
  const [order, setOrder] = useState({})
  const [orderFound, setOrderFound] = useState(false)

  const handleClickOpen = (e) => {
    setGroupOrderID(e.target.dataset.name)
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };
  
  useEffect(() => {
    fetchOrder();
  }, [path]);

  const fetchCustomer = async () => {
    const res = await axiosInstance.post(
      "/userMeasurement/fetchCustomerByID/" + path,
      { token: user.data.token }
    );
    setCustomer(res.data.data[0]);
  };

  const fetchOrder = async () => {

    const res = await axiosInstance.post("/customerOrders/fetchOrderByID/" + path, { token: user.data.token });
    if(res.data.status == true){
      setOrder(res.data.data[0])
      setCustomer(res.data.data[0]['customer_id'])
      setOrderFound(true)
    }
  }


  const handleOrderTypeChange = async (e) => {
    if(e.target.value == 'normal'){
      setOrderType("normal")
      fetchOrders()
    }else if(e.target.value == 'group'){
      setOrderType("group")
      fetchGroupOrders()  
    }
  }

  const handleRepeatGroupOrderForCustomer = async() => {
    // console.log("bbskd")
    // console.log(groupOrderID)
    const res = await axiosInstance.post("/groupOrders/fetchDatag/"+ groupOrderID, {token: user.data.token})

    const newNormalOrder = {}
    // console.log(customer)
    newNormalOrder['order_items'] = res.data.data[0]['order_items']
    newNormalOrder['retailer_id'] = res.data.data[0]['retailer_id']
    newNormalOrder['retailerName'] = user.data.retailer_name
    newNormalOrder['retailer_code'] = user.data.retailer_code
    newNormalOrder['repeatOrder'] = true
    newNormalOrder['total_quantity'] = res.data.data[0]['total_quantity']
    newNormalOrder['customer_id'] = customer['_id']
    newNormalOrder['customerName'] = customer['name']

    const res1 = await axiosInstance.post("/customerOrders/create", {order: newNormalOrder, token: user.data.token})
    if(res1.data.status == true){
      setSnackbarOpen(true);
      setSuccess(true);
      setsuccessMsg(res1.data.message);
    }else{
      setSnackbarOpen(true);
      setError(true);
      setErrorMsg(res1.data.message);
    }




    // console.log(res.data.data)
  }


  // ============================static function====================
  // ============================static function====================


    const fetchOrders = async() => {
      const res = await axiosInstance.post(
        "/customerOrders/fetchCustomerOrders/" + path,
        { token: user.data.token }
      );
      if (res.data.data) {
        setOrders(res.data.data);
      } else {
        setCustomer([]);
        setOrders([]);
      }
    };
    
    const fetchGroupOrders = async () => {
      const res = await axiosInstance.post(
        "/groupOrders/fetchPaginateGroupCustomerOrders/"+path + "/" + user.data.id,
        { token: user.data.token }
      );

      console.log(res.data)
      if (res.data.status == true) {
        setOrders(res.data.data);
      } else {
        setOrders([]);
      }
    }

  // ===============================================================
  // ===============================================================
  const handleCloseAction = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };
  const action = (
    <React.Fragment>
      <Button color="secondary" size="small" onClick={handleClose}>
        UNDO
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleCloseAction}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </React.Fragment>
  );

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="top-heading-title" style={{ borderBottom: "1px solid #e1e1e1" }}>
          <strong>Customer Orders</strong>
        </div>
        <div className="fileupload-box_NM c1">
          <label for="fileInput">
            {customer.image ? (
              <img
                style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                src={PicBaseUrl + customer.image}
                alt=""
                className="uploaded-image"
              />
            ) : (
              <>
                <AccountCircleIcon
                  className="upload-image"
                  color="primary"
                  style={{
                    width: "200px",
                    height: "200px",
                    borderRadius: "50%",
                  }}
                //  fontSize="large"
                />
              </>
            )}

            <div>
              <strong> {!customer ? "--" : `${customer.firstname} ${customer.lastname}`}</strong>
            </div>
          </label>

          <div className="divide">
            <Link
              to={`/retailer/viewCustomers`}
              className="outline-back-btn left-side"
            >
              Back
            </Link>
            <Link
              to={`/retailer/productList/${path}`}
              className="newOrder-back-btn rigth-side"
            >
              Place New Order
            </Link>
          </div>
        </div>

        <div className="order-table manage-page">
          {/* <div>
            <label for="orderType">Order Type</label>
            <select name="" id="orderType" onChange ={handleOrderTypeChange}>
                <option value="0">Select type of order</option>
                <option value="normal">Normal orders</option>
                <option value="group">Group Orders</option>
            </select>
          </div> */}
          <table className="table">
            <thead>
              <tr>
                <th>S.NO.</th>
                <th>ORDER NO</th>
                <th>ORDER DATE</th>
                <th>Details</th>
                <th>QTY</th>
                <th>STATUS</th>
                <th>Total Amount</th>
                <th>PDF</th>
                <th>MANAGE</th>
              </tr>
            </thead>
            <tbody>
              {orderFound == true  ? 
                // orders.map((order, index) => {
                //   return (
                    <tr>
                      <td>{1}</td>
                      <td>{order.orderId}</td>
                      <td>{order.OrderDate}</td>
                      <td>
                        <ul className="ul-point">
                          {order.order_items.length > 0 ? (
                            order.order_items.map((data, i) => {
                              return (
                                <li key={i} className="li-point">
                                  {`${data.quantity
                                    } ${data.item_name.toUpperCase()}`}
                                </li>
                              );
                            })
                          ) : (
                            <>{"--"}</>
                          )}
                        </ul>
                      </td>

                      <td>{order.total_quantity}</td>
                      <td>
                        {
                        order.order_status === "New Order" ? (
                          <span className="newOrderBg">
                            {order.order_status}
                          </span>
                        ) : order.order_status === "Processing" ? (
                          <span className="ProcessingBg">
                            {order.order_status}
                          </span>
                        ) : order.order_status === "Modified" ? (
                          <span className="ModifiedBg">
                            {order.order_status}
                          </span>
                        ) : order.order_status === "Shipment" ? (
                          <span className="ShipmentBg">
                            {order.order_status}
                          </span>
                        ) : order.order_status === "Sent" ? (
                          <span className="SentBg">
                            {order.order_status}
                          </span>
                        ) : 
                        order.order_status === "Rush" ? (
                          <span className="SentBg">
                            {order.order_status}
                          </span>
                        )
                          : <></>
                        }
                      </td>
                      <td>{order.invoice.total_amount}</td>
                      <td>Pending</td>
                      <td>
                        <strong>
                          <Tooltip title="Repeat">
                            {orderType == "normal"
                            ?
                            <Link to={`/retailer/RepeatOrder/${order._id}`}>
                              <RepeatIcon color="success" />
                            </Link>
                            :

                              <RepeatIcon color="success" data-name={order._id} onClick = {handleClickOpen}/>
                            
                            }
                            
                          </Tooltip>
                          {order.order_status === "New Order" ? (
                            <Tooltip title="Edit">
                              <Link to={`/retailer/editOrder/${order._id}`}>
                                <EditIcon
                                  color="primary"
                                  className="link_btn"
                                />
                              </Link>
                            </Tooltip>
                          ) : (
                            <></>
                          )}
                        </strong>
                      </td>
                    </tr>
                //   );
                // })
              : 
                <tr>
                  <td>No data found.......</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
        Do you want to repeat this order for this customer ?.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Disagree</Button>
          <Button onClick={handleRepeatGroupOrderForCustomer} autoFocus>
            Agree
          </Button>
        </DialogActions>
      </Dialog>
      </div>
      {success && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2000}
          onClose={handleCloseAction}
        >
          <Alert
            onClose={handleCloseAction}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2000}
          onClose={handleCloseAction}
          action={action}
        >
          <Alert
            onClose={handleCloseAction}
            severity="error"
            sx={{ width: "100%" }}
          >
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
