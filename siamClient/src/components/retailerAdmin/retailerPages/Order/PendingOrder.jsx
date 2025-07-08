import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import { useState, useContext, useEffect } from "react";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import LocationSearchingIcon from "@mui/icons-material/LocationSearching";
import SettingsIcon from "@mui/icons-material/Settings";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";

export default function PendingOrder() {
  const { user } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);
  const [statusName, setStatusname] = useState("New Order");
  const count = Math.ceil(docLength / limit);

  const fetchData = async (page, limit) => {
    const res = await axiosInstance.post(
      `/customerOrders/RetailerfetchPaginate/?page=${page}&limit=${limit}&order_status=${statusName}&retailer_code=${user.data.retailer_code}`,
      {
        token: user.data.token,
      }
    );
    setDoc(res.data.count);
    setOrders(res.data.data);
  };
  useEffect(() => {
    fetchData(page, limit, statusName);
  }, []);

  const handleChangePage = (e, p) => {
    fetchData(p, limit, statusName);
    setIndex(limit * (p - 1));
    setPage(p);
  };

  return (
    <main className="main-panel">
      <div className="content-wrapper pd-1r">
        <div className="dashboard-top-icon">
          <Link to="/retailer/newCustomer" className="actives">
            {" "}
            <PersonAddAltIcon /> Add New Customer{" "}
          </Link>
          <Link to="">
            {" "}
            <LocationSearchingIcon /> Place Order{" "}
          </Link>
        </div>
      </div>

      <div className="content-wrapper mt-3 pd-1r">
        <div className="topNav">
          <Link to="/">New Order</Link>
          <Link to="/retailerDashboard/retailerModified">Modified</Link>
          {/* <Link to="/retailerDashboard/pendingOrder" className="active">Pending orders</Link> */}
          {/* <Link to="/retailerDashboard/orderplaced"> Order Placed </Link> */}
          <Link to="/retailerDashboard/retailerprocessing">Processing</Link>
          <Link to="/retailerDashboard/retailershippingready">
            Ready For Shipping
          </Link>
          <Link to="/retailerDashboard/retailersent">Sent</Link>
        </div>

        <div className="top-heading-title">
          <strong> Search Order </strong>
        </div>
        <div className="searchstyle searchstyle-one">
          <div className="searchinput-inner">
            <p> Customer Name </p>
            <input type="text" className="searchinput" />
          </div>
          <div className="searchinput-inner">
            <p> Order Number </p>
            <input type="text" className="searchinput" />
          </div>
          <div className="searchinput-inner">
            <button type="button" className="custom-btn">
              {" "}
              SEARCH{" "}
            </button>
          </div>
        </div>
        <div className="order-table mt-3">
          <table className="table">
            <thead>
              <tr>
                <th> Customer Name </th>
                <th> Order No. </th>
                <th> Order Date </th>
                <th> Qty </th>
                <th> View/PDF </th>
                <th> Manage </th>
              </tr>
            </thead>
            <tbody>
              {orders !== null && orders.length > 0 ? (
                orders.map((order, i) => (
                  <tr key={i}>
                    <td>
                      {" "}
                      {`${order.customer_id.firstname} ${order.customer_id.lastname}`}
                    </td>
                    <td> {order.orderId} </td>
                    <td>
                      {" "}
                      {new Date(order.date).toLocaleDateString("es-CL")}{" "}
                    </td>
                    <td> {order.total_quantity} </td>
                    <td>
                      {" "}
                      <Link to=""> View</Link>{" "}
                    </td>
                    <td>
                      {" "}
                      <Button className="Eyebtn">
                        {" "}
                        <BorderColorIcon />{" "}
                      </Button>{" "}
                      <Button className="Eyebtn">
                        {" "}
                        <DeleteOutlineIcon />{" "}
                      </Button>{" "}
                    </td>
                    {/* <td> Note(0) </td> */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td>
                    <p>No data found!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {count > 1 && (
            <Stack spacing={2}>
              <Pagination
                count={count}
                color="primary"
                onChange={handleChangePage}
              />
            </Stack>
          )}
        </div>
      </div>
    </main>
  );
}
