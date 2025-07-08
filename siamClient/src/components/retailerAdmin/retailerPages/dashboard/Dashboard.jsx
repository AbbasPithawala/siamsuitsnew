import React from 'react'
import "./dashboard.css";
import { Link } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import SettingsIcon from '@mui/icons-material/Settings';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Context } from '../../../../context/Context';
import { axiosInstance } from '../../../../config';
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
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import { renderToString } from "react-dom/server";
import jsPDF from "jspdf";
import { PicBaseUrl, PicBaseUrl3, PicBaseUrl4 } from "../../../../imageBaseURL";
import mainQR from "../../../../images/PDFQR.png";
import "./../../../../fonts/THSarabunNewRegular-normal"
import "./../../../../fonts/Itim Regular-normal";
import "./../../../../fonts/THSarabunNewRegular.ttf"
import { red } from '@mui/material/colors';

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function Dashboard() {

  const {user} = useContext(Context)
  const [orders, setOrders] = useState([]);
  const [paginatedOrders, setPaginatedOrders] = useState([])
  const [custName, setCustName] = useState("")
  const [orderId, setOrderId] = useState("")
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);

  
  const [l0, setLength0] = useState(Number);
  const [l1, setLength1] = useState(Number);
  const [l2, setLength2] = useState(Number);
  const [l3, setLength3] = useState(Number);
  const [l4, setLength4] = useState(Number);
  const [l5, setLength5] = useState(Number);
  const [l6, setLength6] = useState(Number);
  const [l7, setLength7] = useState(Number);

  const [statusName, setStatusname] = useState("");
  const [customerOrderId, setCustomerOrderId] = useState("")
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [RepeatproductMeasurements, setRepeatproductMeasurements] = useState({});
  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [products, setProducts] = useState([]);
  const [customerID, setCustomerID] = useState("");
  const [showCustomerList, setShowCustomerList] = useState("none");
  const [showOrders, setShowOrders] = useState(false)
  const [allCustomers, setAllCustomers] = useState([]);

  const fetchData = async() => {
    const par = {
      order_status: statusName,
      retailer_code: user.data.retailer_code
    }

    if(customerID.length > 0){
      par['customer_id'] = customerID
      count['customer_id'] = customerID
    }

    if(orderId.length > 0){
      par['orderId'] = orderId
      count['orderId'] = orderId
    }
    const res = await axiosInstance.post('/customerOrders/fetchRetailerPaginateNew', {
    // const res = await axiosInstance.post(`/customerOrders/fetchRetailerPaginate/?page=${page}&limit=${limit}&order_status=${statusName}&retailer_code=${code}&orderId=${orderId}`, {
      token: user.data.token,
      par: par
    });
    setDoc(res.data.count)
    if(res.data.data){
      setOrders(res.data.data);
    }else{
      setOrders([])
    }
  }

  const fetchPageOrders = async(par, count, skip) => {
    console.log(par, count)
    const res = await axiosInstance.post("/customerOrders/fetchRetailerPaginateNew/" + skip, {
      token: user.data.token,
      par: par,
      count: count
    })

    setDoc(res.data.docCount)

    if(res.data.status == true){
      setShowOrders(true)
      setOrders(res.data.data)
    }else{
      setShowOrders(false)
      setOrders([])
    }
  }


  useEffect(() => {
    const par = {
      order_status: statusName,
      retailer_code: user.data.retailer_code
    }
    
    const count= {
      order_status: statusName,
      retailer_code: user.data.retailer_code
    }

    if(customerID.length > 0){
      par['customer_id'] = customerID
      count['customer_id'] = customerID
    }

    if(orderId.length > 0){
      par['orderId'] = orderId
      count['orderId'] = orderId
    }
    fetchPageOrders(par, count, (page - 1)*5)

    // fetchData(page, statusName, user.data.retailer_code);
  }, [page, statusName]);

  useEffect(() => {
    fetchProducts();
    const par = {}
    par['retailer_code'] =  user.data.retailer_code
    fetchAllOrders(par);
  }, [])
  
  const count = Math.ceil(docLength / limit);

  const handleChangePage = (e,p) => {
    setIndex(limit*(p-1))
    setPage(p)
  }
  
  const handleSearchSubmit = async(event) => {
    setOrderId(event.target.value)
  }
  
  const handleSearch = () => {
    const parForTabs = {      
      retailer_code: user.data.retailer_code
    }
    const par = {
      order_status: statusName,
      retailer_code: user.data.retailer_code
    }
    
    const count = {
      order_status: statusName,
      retailer_code: user.data.retailer_code
    }


    if(customerID.length > 0){
      par['customer_id'] = customerID
      count['customer_id'] = customerID
      parForTabs['customer_id'] = customerID
    }
    
    if(orderId.length > 0){
      par['orderId'] = orderId
      count['orderId'] = orderId
      parForTabs['orderId'] = orderId
    }


    setPage(1)
    fetchPageOrders(par, count, (1 - 1) * 5)
    fetchAllOrders(parForTabs);
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

  const handleClickOpen = (id) => {
      setOpen2(true)
      setCustomerOrderId(id)
  };

  const handleClose2 = () => {
      setOpen2(false)
  }

  const handleDelete = async () => {
    
    const res = await axiosInstance.post(`/customerOrders/OrderCancel/${customerOrderId}`, {token:user.data.token})
    
    if(res.data.status == true){
      const par = {
        order_status: statusName,
        retailer_code: user.data.retailer_code
      }
      
      const count = {
        order_status: statusName,
        retailer_code: user.data.retailer_code
      }
  
  
      if(customerID.length > 0){
        par['customer_id'] = customerID
        count['customer_id'] = customerID
      }
      
      if(orderId.length > 0){
        par['orderId'] = orderId
        count['orderId'] = orderId
      }
      fetchPageOrders(par, count, (page - 1)*5)
      setOpen2(false)
      setOpen(true)
      setSuccess(true)
      setError(false)
      setSuccessMsg(res.data.message)
    }else{
      setOpen2(false)
      setOpen(true)
      setError(true)
      setSuccess(false);
      setErrorMsg(res.data.message)
    }

  }

  const handleStatusChange = (e) => {
    setStatusname(e.target.dataset.name)
    setPage(1)
  }

  const handleClose = (event, reason) => {
  if (reason === "clickaway") {
    return;
  }
  setSuccess(false);
  setOpen(false);
  setError(false);
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

    // fetch draft measurements=====================
    // console.log(res.data)
    // const res2 = await axiosInstance.post("/draftMeasurements/fetch/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
    // console.log(res2.data)
    let draftMeasurementsObj = {}
    if(res.data.data[0].repeatOrder == true){
      const previousOrder = await axiosInstance.post("/customerOrders/fetchOrderByID/" + res.data.data[0]['repeatOrderID'], {token : user.data.token})
      draftMeasurementsObj = previousOrder.data.data[0]['measurements']
    }else{
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
  
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
          // draftMeasurementsObj = existingOrders.data.data[ourIndex + 1]['measurements']
        }
      }
    }
    
   



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
    }


    let singleOrderArray2 = [];

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
            
            singleOrderArray2.push(itemsObject1);
            
            singleOrderArray2.push(itemsObject2);

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
          singleOrderArray2.push(itemsObject);
        }
      }
    }

    const orderItemsArrayPDFString = JSON.stringify(orderItemsArrayPDF)

    const singleOrderArrayString = JSON.stringify(singleOrderArray2)

    const productFeaturesObjectString = JSON.stringify(productFeaturesObject)

    const draftMeasurementsObjString = JSON.stringify(draftMeasurementsObj)

    const pdfString = await axiosInstance.post('customerOrders/createPdf', {
      token: user.data.token,
      productFeaturesObject: productFeaturesObjectString,
      orderItemsArray: orderItemsArrayPDFString,
      singleOrderArray: singleOrderArrayString,
      draftMeasurementsObj: draftMeasurementsObjString,
      order: JSON.stringify(res.data.data[0]),
      retailer: JSON.stringify(res1.data.data[0])
    })
    if(pdfString.data.status == true){

      const sendMail = await axiosInstance.post('customerOrders/sendMail', {
        token: user.data.token,
        order: res.data.data[0]['orderId']
      })

      setSuccessMsg("PDF Generated Successfully")
      setError(false)
      setSuccess(true)
      // const sendMail = await axiosInstance.post('customerOrders/sendMail', {
      //   token: user.data.token,
      //   order: res.data.data[0]['orderId']
      // })
      // console.log('done')
    }
    


    // doc.html(elementAsString, {
    //   async callback(doc) {
    //     window.open(doc.output("bloburl"), "_blank");
    //   }
    // });
    
  };

  const handleOpenPdf = async(data) => {
    const res =  await axiosInstance.post('customerOrders/checkPdf', {
      token: user.data.token,
      pdf: data
    })
    if(res.data.status == true){
      const url = PicBaseUrl4 + "pdf/" + data;
      window.open(url);
    }else{
      setErrorMsg(res.data.message)
      setSuccess(false)
      setError(true)
    }
  }

  const handleSelectCustomer = (e) => {
    setCustomerID(e.target.dataset.val)
    setShowCustomerList("none")
    setAllCustomers([])
}

const handleFetchCustomers = async(e) => {
  if(e.target.value.length > 2){
    const res = await axiosInstance.post("/userMeasurement/fetchCustomerByLike/" + e.target.value , { token:user.data.token })
    if(res.data.data.length > 0){
      setAllCustomers(res.data.data)
      setShowCustomerList("block")
    }
  }
  if(!e.target.value.length > 0){
    setShowCustomerList("none")
    setAllCustomers([])
  }
}


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

// ====================================================
// ====================static function=================

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


console.log("orders: ",  orders)

const fetchAllOrders = async (par) => {

  const res = await axiosInstance.post("/customerOrders/fetchAll", {
    token: user.data.token,
    par: par
  });
  if(res.data.status === true){
    setDoc(res.data.data ? res.data.data.length : 0)
    setLength0(res.data.data.length)
    let L = res.data.data.filter((x) => x.order_status == "New Order");
    setLength1(L.length);

    let L2 = res.data.data.filter((x) => x.order_status == "Modified");
    setLength3(L2.length);

    let L1 = res.data.data.filter((x) => x.order_status == "Rush");
    setLength2(L1.length);
    
    let L3 = res.data.data.filter((x) => x.order_status == "Processing");
    setLength4(L3.length);

    let L4 = res.data.data.filter((x) => x.order_status == "Shipment");
    setLength5(L4.length); 

    let L5 = res.data.data.filter((x) => x.order_status == "Sent");
    setLength6(L5.length);

  }

};
// ====================================================
// ====================================================

  return (
    <>
      <main className="main-panel">
        <div className="content-wrapper pd-1r">
          <div className="dashboard-top-icon">
            <Link to="/retailer/newCustomer" className=""> <PersonAddAltIcon style={{color:"#1C4D8F"}}/> Add New Customer </Link>
          </div>
        </div>

        <div className="content-wrapper mt-3 pd-1r"> 
          <div className="topNav">
            <ul>
              <li className={statusName == "" ? "active" : ""} data-name="" onClick={handleStatusChange}> All Orders          ({l0})</li>
              <li className={statusName == "New Order" ? "active" : ""} data-name="New Order" onClick={handleStatusChange}> New Order          ({l1})</li>
              <li className={statusName == "Rush" ? "active" : ""} id="rush"  data-name="Rush" onClick={handleStatusChange}> Rush Order         ({l2})</li>
              <li className={statusName == "Modified" ? "active" : ""}            data-name="Modified" onClick={handleStatusChange}> Modified           ({l3})</li>
              <li className={statusName == "Processing" ? "active" : ""}            data-name="Processing" onClick={handleStatusChange}> Processing         ({l4})</li>
              <li className={statusName == "Shipment" ? "active" : ""}            data-name="Shipment" onClick={handleStatusChange}> Ready For Shipping ({l5})</li>
              <li className={statusName == "Sent" ? "active" : ""}            data-name="Sent" onClick={handleStatusChange}> Sent               ({l6})</li>
            </ul>
          </div>

            <div className="top-heading-title">
              <strong> Search Order  </strong>
            </div>
          <div className="searchstyle searchstyle-one">
              
                <div>
                  <p>Customer Name</p>
                  <input  className="searchinput" type="text" onChange = {handleFetchCustomers}/>
                </div>
                <div style={{display:showCustomerList}} className="customer-list2">
                  <ol>
                    {allCustomers.map((singleCustomer) => {
                        return (
                          <li style={{color: "green"}} key={singleCustomer['_id']} data-val={singleCustomer['_id']} onClick={handleSelectCustomer}>{singleCustomer['firstname'] +" " + singleCustomer['lastname']}</li>
                        )
                      
                    })}
                  </ol>
                </div>
                <div className="searchinput-inner">
                <p> Order Number </p>
                <input type="text" className="searchinput" placeholder='type here' onChange={(e)=>handleSearchSubmit(e)}/>
                </div>
                <div>
                  <span style={{marginLeft: "10px"}}>
                    <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button>
                  </span>
                </div>
              </div>

          <div className="order-table mt-3">
              <table className="table">
              <thead>
                  <tr>
                  <th>Order #</th>
                  <th>Total Qty</th>
                  <th> Customer Name </th>
                  <th> Type </th>
                  <th>View</th>
                  <th>Generate</th>
                  <th>Status</th>
                  <th> Order Date </th>
                  <th> Manage </th>
                  </tr>
              </thead>
              <tbody>
                {orders !==null && orders.length > 0 ? orders.map((order, i) => {
                  if(order.orderCancle === "No") {
                    return (
                      <tr key={i}>
                      <td> {order.orderId} </td>
                      <td> {order.total_quantity} </td>
                      <td> {order.customerName} </td>
                      <td> {order.type  == "group"?     
                            <span className="ModifiedBg" style={{textTransform: "capitalize"}}>
                              {order.type}
                            </span> : 
                            <span className="newOrderBg" style={{textTransform: "capitalize"}}>
                              Normal
                            </span> 
                            } </td>
                      <td> 
                            <strong>
                              <button
                                // onClick={() => exportPDF(order._id)}
                                onClick={() => handleOpenPdf(order.orderId)}
                                target="_blank"
                                rel="noreferrer"
                                className="action"
                              >
                                view
                              </button>
                            </strong>
                      </td>
                      <td> 
                      {
                        order.order_status == "Processing" || order.order_status == "Shipment" || order.order_status == "Sent" || order.order_status == "Modified"
                        ?
                        <strong >N/A</strong>
                        :

                            <strong>
                              <button
                                onClick={() => exportPDF(order._id)}
                                // onClick={() => handleOpenPdf(order.orderId)}
                                target="_blank"
                                rel="noreferrer"
                                className="action"
                              >
                                gen
                              </button>
                            </strong>

                      }
                            
                      </td>
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
                      <td> {order.OrderDate} </td>

                      <td>
                      {
                        order.order_status == "Processing" || order.order_status == "Shipment" || order.order_status == "Sent" || order.order_status == "Modified"
                        ?
                        <strong>N/A</strong>
                        :
                        <>
                          <Link to={`/retailer/editOrder/${order._id}`}><Button className="Eyebtn"><BorderColorIcon /></Button></Link> 
                          <Button className="Eyebtn" onClick={()=>handleClickOpen(order._id)}> <DeleteOutlineIcon /> </Button>
                        </>
                      }
                      </td>
                    </tr>
                    )
                  }

                }) : 
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
          <Snackbar
            open={error}
            autoHideDuration={2000}
            onClose={handleClose}
            action={action}
          >
            <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
              {errorMsg}
            </Alert>
          </Snackbar>
        )}
      </main>  
    </>
  )
}

