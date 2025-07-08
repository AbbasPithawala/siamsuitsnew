import React, { useContext, useEffect, useState } from 'react'
import { Link } from "react-router-dom";
import { axiosInstance } from "./../../../../config";
import { Context } from "./../../../../context/Context";
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';


export default function ViewCustomer() {
  const { user } = useContext(Context);
  const [skip, setSkip] = useState(0);
  const [pageCount, setPageCount] = useState(10)
  const [customers, setCustomers] = useState([])
  const [open, setOpen] = useState(false);
  const [previousOrder, setPreviousOrder] = useState({});
  // const [customerName, setCustomerName] = useState("");
  let [name, setName] = useState("");
  let [name2, setName2] = useState("");
  let [code, setCode] = useState(user.data.retailer_code);
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);

  const handleClose = () => {
    setOpen(false);
  };

  
  useEffect(() => {
    fetchCustomers(page, limit, code, name, name2)
  }, [page]);

  const fetchCustomers = async (page, limit, code, name) => {
    const res = await axiosInstance.post(`/userMeasurement/getAllCustomersMesurementPaginated/?page=${page}&limit=${limit}&retailer_code=${code}&fullname=${name}`, { token: user.data.token })
    setPageCount(res.data.meta.totalDocs)
    setCustomers(res.data.data)
  }

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
     fetchCustomers(1, limit, code, value.trim());
  };

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Search Customers</strong>
            <Link to="/retailer/newCustomer" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New Customer </Link>
          </div>
          <div className="searchstyle searchstyle-two">
            <div className="searchinput-inner">
              <p>Customer Name</p>
              <input type="text"  className='searchinput' onChange={searchFirstChange} />
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>CUSTOMER NAME</th>
                <th>EMAIL</th>
                <th>PROFILE</th>
                <th>ORDER</th>
              </tr>
            </thead>
            <tbody>

              {customers.length > 0
                ?
                customers.map((customer, key) => {
                  return (
                    <tr key={key}>
                      <td>
                      <strong>{key + 1 + index}</strong>
                      </td>
                      <td>{customer.firstname.charAt(0).toUpperCase() + customer.firstname.slice(1)+ " " + customer.lastname.charAt(0).toUpperCase() + customer.lastname.slice(1)}</td>
                      <td>{customer.email ? customer.email : " -- "}</td>
                      <td><strong>
                        <Link to={`/retailer/editCustomer/${customer._id}`} className="action">Edit</Link></strong></td>
                     <td><strong>
                        <Link to={`/retailer/customerOrders/${customer._id}`} className="action">
                          <VisibilityIcon color="primary"/>
                        </Link>
                      </strong></td>
                    </tr>
                  )
                })
                :
                <>
                  <tr>
                    <td>
                      <strong>Not found data...</strong>
                    </td>
                  </tr>
                </>
              }
            </tbody>
          </table>
        </div>

        <Stack spacing={2}>
          <Pagination count={count} page={page} color="primary" onChange={handleChange} />
        </Stack>
      </div>

      <div>
        <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            <div className="top-heading-title">
              <strong>Previous Order</strong>
            </div>
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <main className="main-panel">
                <div className="content-wrapper">
                  <div className="order-table manage-page">

                    <table className="table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>CUSTOMER NAME</th>
                          <th>OREDER NO</th>
                          <th>ORDER DATE</th>
                          <th>QTY</th>
                          <th>STATUS</th>
                          <th>PDF</th>
                          <th>MANAGE</th>
                        </tr>
                      </thead>
                      <tbody>

                        {
                          previousOrder !== undefined
                          ||
                          previousOrder !== null
                          ?
                          <tr>
                          <td>01</td>
                          <td>{previousOrder.customerName}</td>
                          <td>{previousOrder.orderId}</td>
                          <td>{previousOrder.orderDate}</td>
                          <td>{previousOrder.total_quantity}</td>
                          <td>{previousOrder.order_status}</td>
                          <td>Pending</td>
                          <td><strong><Link to="#" className="action">Order</Link></strong></td>
                        </tr>
                        :
                        <>Loading...</>
                        }
                     

                      </tbody>
                    </table>
                  </div>
                </div>
              </main>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>CLose</Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  )
}


