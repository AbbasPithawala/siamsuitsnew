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
import { Context } from '../../../../../context/Context';
import { axiosInstance } from '../../../../../config';
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";

export default function SentGroupOrder() {
    const { user } = useContext(Context);
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [docLength, setDoc] = useState(Number);
    const [limit, setLimit] = useState(5);
    const [index, setIndex] = useState(0);
    let [name, setName] = useState("");
    let [code, setCode] = useState(user.data.retailer_code)
    const [statusName, setStatusname] = useState("Sent");
    const count = Math.ceil(docLength / limit);

    const fetchData = async (page, limit, statusName, code, name) => {
        const res = await axiosInstance.post(`/groupOrders/fetchPaginate/?page=${page}&limit=${limit}&order_status=${statusName}&retailer_code=${code}&name=${name}`, {
            token: user.data.token,
        });
        setDoc(res.data.meta.totalDocs)
        setOrders(res.data.data);
    }


    useEffect(() => {
        fetchData(page, limit, statusName, code, name);
    }, [page]);

    const handleChangePage = (e, p) => {
        fetchData(page, limit, statusName, code, name);
        setIndex(limit * (p - 1));
        setPage(p);
    };

    const searchFirstChange = async (event) => {
        const { value } = event.target;
        name = value;
        setName(value);
        fetchData(1, limit, statusName, code, value.trim());
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
                    <Link to="">
                        {" "}
                        <SettingsIcon /> Manage Order{" "}
                    </Link>
                </div>
            </div>

            <div className="content-wrapper mt-3 pd-1r">
                <div className="topNav">
                    <Link to="/retailer/placeGroupOrder">New Order</Link>
                    <Link to="/retailer/modifiedGroupOrder">Modified</Link>
                    {/* <Link to="/retailerDashboard/pendingOrder">Pending orders</Link> */}
                    {/* <Link to="/retailerDashboard/orderplaced"> Order Placed </Link> */}
                    <Link to="/retailer/processingGroupOrder">Processing</Link>
                    <Link to="/retailer/readyForShippingGroupOrder">Ready For Shipping</Link>
                    <Link to="/retailer/sentGroupOrder" className="active">Sent</Link>
                </div>

                <div className="top-heading-title">
                    <strong> Search Order </strong>
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
                                {/* <th>Manage</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {orders !== null && orders.length > 0 ? orders.map((order, i) => (
                                <tr key={i}>
                                    <td> {order.orderId} </td>
                                    <td> {order.product_quantity} </td>
                                    <td> {order.customer_quantity} </td>
                                    <td> {order.name} </td>
                                    <td> {order.orderDate} </td>
                                    {/* <td> <Link to={`/retailer/editOrder/${order._id}`}><Button className="Eyebtn"><BorderColorIcon /></Button></Link> <Button className="Eyebtn" onClick={() => handleClickOpen(order._id)}> <DeleteOutlineIcon /> </Button>  </td> */}
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
