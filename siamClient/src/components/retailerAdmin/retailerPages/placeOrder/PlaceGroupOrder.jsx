import React from 'react'
import "../../dashboard/dashboard.css";
import { Link } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import SettingsIcon from '@mui/icons-material/Settings';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Context } from '../../../../../context/Context';
import { axiosInstance } from '../../../../../config';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function PlaceGroupOrder() {

  const {user} = useContext(Context)
  const [orders, setOrders] = useState([])
  const [custName, setCustName] = useState("")
  const [orderId, setOrderId] = useState("")
  let [name, setName] = useState("");
  let [code, setCode] = useState(user.data.retailer_code)
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);
  const [statusName, setStatusname] = useState("New Order");
  const count = Math.ceil(docLength / limit);
  const [groupOrderId, setGroupOrderId] = useState("")
  const [success, setSuccess] = useState(false)
  const [open, setOpen] = useState(false)
  const [open2, setOpen2] = useState(false)

  const fetchData = async(page, limit, statusName, code, name) => {
    const res = await axiosInstance.post(`/groupOrders/fetchPaginate/?page=${page}&limit=${limit}&order_status=${statusName}&retailer_code=${code}&name=${name}`, {
      token: user.data.token,
    });
    setDoc(res.data.meta.totalDocs)
    setOrders(res.data.data);
  }

  useEffect(() => {
    fetchData(page,limit,statusName, code, name);
  }, [page]);
  
  const handleChangePage = (e,p) => {
    fetchData(page, limit, statusName, code, name);
    setIndex(limit*(p-1))
    setPage(p)
  }
  

  const searchFirstChange = async (event) => {
    const { value } = event.target;
    name = value;
    setName(value);
    fetchData(1, limit,statusName,code,value.trim());
  };

  const handleClickOpen = (id) => {
    setOpen2(true)
    setGroupOrderId(id)
 };

 const handleClose2 = () => {
    setOpen2(false)
 }

 const handleDelete = async () => {
   
   const res = await axiosInstance.post(`/groupOrders/deleteGroupOrder/${groupOrderId}`, {token:user.data.token})
   if(res){
    fetchData(page,limit,statusName,code);
   }
   setOpen2(false)
   setOpen(true)
   setSuccess(true)
 }


const handleClose = (event, reason) => {
 if (reason === "clickaway") {
   return;
 }

 setSuccess(false);
 setOpen(false)
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
     onClick={handleClose}
   >
     <CloseIcon fontSize="small" />
   </IconButton>
 </React.Fragment>
);


  return (
    <>
    <main className="main-panel">
      <div className="content-wrapper pd-1r">
        <div className="dashboard-top-icon">
          <Link to="/retailer/newCustomer" className="actives"> <PersonAddAltIcon style={{color:"#1C4D8F"}}/> Add New Customer </Link>
          <Link to=""> <LocationSearchingIcon  style={{color:"#1C4D8F"}}/> Place Order </Link>
          <Link to=""> <SettingsIcon  style={{color:"#1C4D8F"}}/> Manage Order </Link>
        </div>
      </div>

      <div className="content-wrapper mt-3 pd-1r">
        <div className="topNav">
          <Link to="/retailer/placeGroupOrder" className="active"> New Order </Link>
          <Link to="/retailer/modifiedGroupOrder">Modified</Link>
          {/* <Link to="/retailerDashboard/pendingOrder">Pending orders</Link> */}
          {/* <Link to="/retailerDashboard/orderplaced"> Order Placed </Link> */}
          <Link to="/retailer/processingGroupOrder"> Processing </Link>
          <Link to="/retailer/readyForShippingGroupOrder"> Ready For Shipping </Link>
          <Link to="/retailer/sentGroupOrder"> Sent </Link>
        </div>

          <div className="top-heading-title">
            <strong> Search Order  </strong>
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

         <div className="order-table mt-3">
            <table className="table">
             <thead>
                <tr>
                  <th>Order #</th>
                  <th>Product Qty</th>
                  <th>No of Customer</th>
                  <th>Group Name</th>
                  <th>Date</th>
                  <th>Manage</th>
                </tr>
            </thead>
            <tbody>
              {orders !==null && orders.length > 0 ? orders.map((order, i) => (
              <tr key={i}>
                <td> {order.orderId} </td>
                <td> {order.product_quantity} </td>
                <td> {order.customer_quantity} </td>
                <td> {order.name} </td>
                <td> {order.orderDate} </td>
                <td> <Link to=""><Button className="Eyebtn"><BorderColorIcon /></Button></Link> <Button className="Eyebtn" onClick={()=>handleClickOpen(order._id)}> <DeleteOutlineIcon /> </Button>  </td>
              </tr>
              )) : 
              <tr>
                <td>
                 <p>No data found!</p>
                </td>
              </tr>
            }
            </tbody>
            </table>
            
              <Stack spacing={2}>
                <Pagination count={count} page={page} color="primary" onChange={handleChangePage} />
              </Stack>
     
          </div>

      </div> 
      <Dialog
                open={open2}
                onClose={handleClose2}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Confirmation?"}
                </DialogTitle>
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
    </main>  
    </>
  )
}

