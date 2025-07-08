import React from "react";
import { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import './shipping.css';
import { Button } from "@mui/material";
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import { axiosInstance } from "../../../../config";
import { Context } from "./../../../../context/Context";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import CancelIcon from '@mui/icons-material/Cancel';
import RetailerLogo from "./../../../../images/just.jpg";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageUpload from "./../../../../images/ImageUpload.png";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import jsPDF from "jspdf";

import { PicBaseUrl } from "./../../../../imageBaseURL";


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ShippingBoxReport() {

  const [data, setData] = useState();
  const { user } = useContext(Context);
  const [shippingBoxes, setShippingBoxes] = useState([])
  const [allRetailers, setAllRetailers] = useState([]);
  const [retailer, setRetailer] = useState("");
  const [openEditBox, setOpenEditBox] = useState(false);
  const [shippingBox, setShippingBox] = useState({});
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open1, setOpen1] = useState(false);

  const [retailerName, setRetailerName] = useState("")
  const [retailer_logo, setRetailer_logo] = useState("")

  let htmlElement = useRef(null)


  useEffect(() => {
    fetchShippingBoxes();
    fetchRetailers();
  }, [])

  const handleChange = () => {

  }
  const handleSelectRetailer = (e) => {
    const ret = allRetailers.filter((retailer) => retailer['_id'] === e.target.value)
    setRetailer(ret[0])
    fetchShippingBoxes(e.target.value)
  }

  const handleEditShippingBoxDialog = (e) => {
    const shippingBoxArray = shippingBoxes.filter((box) => e.target.dataset.id == box['_id'])
    setShippingBox(shippingBoxArray[0])
    setOpenEditBox(true)
  }

  const handleCloseEditBox = () => {
    setOpenEditBox(false)
  }

  const handleEditShippingBox = (e) => {
    shippingBox[e.target.dataset.name] = e.target.value
    setShippingBox({ ...shippingBox })
  }
  const handleDelete = (e) => {
    const newArray = shippingBox['items'].filter((item) => item !== e.target.dataset.name)
    shippingBox['items'] = newArray
    setShippingBox({ ...shippingBox })
  };
  const handleEdit = (e) => {
    const updateBody = {
      isClosed: shippingBox['isClosed'],
      items: shippingBox['items'],
      tracking_code: shippingBox['tracking_code'],
      name: shippingBox['name']
    }
    updateShippingBox(updateBody)
  }

  const handleOpenViewShippingBoxDialog = (e, id) => {
    const shippingBoxArray = shippingBoxes.filter((box) => id == box['_id'])
    setShippingBox(shippingBoxArray[0])
    
    let stringified = JSON.stringify(PicBaseUrl + shippingBoxArray[0]['retailer']['retailer_logo'])
    let parsed = JSON.parse(stringified)
    setRetailer_logo(parsed)
    setRetailerName(shippingBoxArray[0]['retailer']['retailer_name'])

    setOpen(true)
  }

    
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false)
    setOpen(false)
    setError(false)
  }
  // ====================static functions======================
  // ==========================================================
  const fetchShippingBoxes = async (retailerType = 'no') => {
    const res = await axiosInstance.post("/shipping/fetch", { token: user.data.token, retailer: retailerType })
    if (res.data.status == true) {
      setShippingBoxes(res.data.data)
      
      setOpen1(true)
      setSuccess(true)
      setSuccessMsg("Boxes fetched successfully!")
      setError(false)
    } else {
      setShippingBoxes([])
      
      setOpen1(true)
      setSuccess(false)
      setErrorMsg("No closed boxes for this retailer!")
      setError(true)
    }
  };

  const fetchRetailers = async () => {
    const res = await axiosInstance.post("/retailer/fetchAll", {
      token: user.data.token,
    });
    setAllRetailers(res.data.data);
  };

  const updateShippingBox = async (body) => {
    const res = await axiosInstance.put("/shipping/update/" + shippingBox['_id'], {
      token: user.data.token,
      shippingBox: body
    })
    if (res.data.status == true) {
      setShippingBox(res.data.data[0])
      setOpenEditBox(false)
      
      setOpen1(true)
      setSuccess(true)
      setSuccessMsg("Box Edited successfully!")
      setError(false)
    }else{
      
      setOpen1(true)
      setSuccess(false)
      setErrorMsg(res.data.message)
      setError(true)
    }
  };
  console.log("shipping box: ", shippingBox)
  const PackagingPDF = () => {

    let doc = new jsPDF("l", "px", [595, 920]);

    doc.html(htmlElement.current, {
      async callback(doc) {
        window.open(doc.output("bloburl"), "_blank");
      }
    });
  }
  // ==========================================================
  // ==========================================================

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table managemeasurement-page">
          <div className="top-heading-title">
            <strong>Packaging List</strong>
          </div>
          <div className="searchstyle searchstyle-one">
            {/* <div className="searchinput-inner">
              <p>Customer Id</p>
              <input type="text" className="searchinput" placeholder="123456" />
            </div>
            <div className="searchinput-inner">
              <p>Order Number</p>
              <input type="text" className="searchinput" placeholder="123456" />
            </div> */}
            <div className="searchinput-inner">
              <p>Retailer</p>
              <select className="searchinput" onChange={(e) => handleSelectRetailer(e)}>
                <option value="">Select Retailer</option>
                {
                  allRetailers

                    ?

                    allRetailers.map((retailer) => {
                      return (
                        <option key={retailer['_id']} value={retailer['_id']}>{retailer['retailer_name']}</option>
                      )
                    })

                    :

                    <></>
                }
              </select>
              {/* <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button> */}
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>SR. NO</th>
                <th>DATE</th>
                <th>BOX TRACKING NO</th>
                <th>RETAILER</th>
                <th>PRODUCT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {shippingBoxes
                ?
                shippingBoxes.map((shippingBox, index) => {

                  const itemArray = {}
                  if (shippingBox['items'].length > 0) {
                    for (let x of shippingBox['items']) {
                      const itemName = x.split("/")[1].split("_")[0]
                      if (Object.keys(itemArray).length > 0) {
                        if (!Object.keys(itemArray).includes(itemName)) {
                          if(itemName == 'suit' || itemName == 'tuxedo'){
                            itemArray[itemName] = 0.5
                          }else{                            
                            itemArray[itemName] = 1
                          }
                        } else {
                          if(itemName == 'suit' || itemName == 'tuxedo'){                            
                          itemArray[itemName] = itemArray[itemName] +  0.5
                          }else{                   
                            itemArray[itemName] = itemArray[itemName] + 1
                          }
                        }
                      } else {
                        // itemArray[itemName] = 1
                        if(itemName == 'suit' || itemName == 'tuxedo'){                            
                          itemArray[itemName] = 0.5
                          }else{                   
                            itemArray[itemName] = 1
                          }
                      }
                    }
                  }
                  let itemString = "";
                  for (let x of Object.keys(itemArray)) {
                    itemString = itemString + itemArray[x] + " " + x + " "
                  }
                  return (
                    <tr key={shippingBox['_id']}>
                      <td>{index + 1}</td>
                      <td>{new Date(shippingBox['date']).toLocaleDateString('en-US')}</td>
                      <td >{shippingBox['tracking_code']}</td>
                      <td style={{ textTransform: "capitalize" }}>{shippingBox['retailer']['retailer_name']}</td>
                      <td style={{ textTransform: "capitalize" }}>{itemString}</td>
                      <td>
                        <Button data-id={shippingBox['_id']} className="Eyebtn" onClick={handleEditShippingBoxDialog}> <EditIcon data-id={shippingBox['_id']} onClick={handleEditShippingBoxDialog}></EditIcon> </Button>
                        <Button data-id={shippingBox['_id']} className="Eyebtn" onClick={(e) => handleOpenViewShippingBoxDialog(e, shippingBox['_id'])}>
                          <RemoveRedEyeIcon data-id={shippingBox['_id']} onClick={(e) => handleOpenViewShippingBoxDialog(e, shippingBox['_id'])}/>
                        </Button>
                        {/* <Button className="Eyebtn"> <EmailIcon /> </Button> */}
                        </td>
                    </tr>
                  )
                })
                :
                <>No Closed Box</>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={openEditBox}
        onClose={handleCloseEditBox}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="popup-form">
          <div className="field">
            <label htmlFor="">Box Name</label>
            <input type="text" data-name="name" value={shippingBox['name'] ? shippingBox['name'] : ""} onChange={(e) => handleEditShippingBox(e)} />
          </div>
          <div className="field">
            <label htmlFor="">Tracking Code</label>
            <input type="text" data-name="tracking_code" value={shippingBox['name'] ? shippingBox['tracking_code'] : ""} onChange={(e) => handleEditShippingBox(e)} />
          </div>
          <div className="field">
            <label htmlFor="">QR Codes</label>
            <Stack direction="row" spacing={1} data-name="items">
              {shippingBox['items']
                ?
                shippingBox['items'].map((items) => {
                  return (
                    <Chip label={items} data-name={items} value={items} onClick={(e) => handleDelete(e)} />
                  )
                })
                :
                <></>}
            </Stack>
          </div>
          <div className="field">
            <label htmlFor="">Closed</label>
            <select data-name="isClosed" id="" onChange={(e) => handleEditShippingBox(e)}>
              <option value="true">Close</option>
              <option value="false">Open</option>
            </select>
          </div>
        </div>

        <DialogActions>
          <Button className="custom-btn" onClick={handleEdit}>Edit</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="shippingbox-view">
          <div className="shippingbox-view-heading">
            <strong>View Shipping Box</strong>
          </div>
          <div className="shippingbox-view" ref={htmlElement}>
          <div className="shipping-box-details">
            <div className="shipping-box-content">
              <p>Tracking Number : <strong>{open ? shippingBox['tracking_code'] : ""}</strong></p>
              <p>Shipping Date :  <strong>{open ? new Date(shippingBox['date']).toLocaleDateString() : ""}</strong></p>
            </div>
            <div className="shipping-box-content">
              <img src={open ? retailer_logo.length > 0 ? retailer_logo : ImageUpload: ""} width="100" height="100" />
              <p>Retailer Name : {open ? retailerName : ""}</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ORDER NO.</th>
                <th>CUSTOMER NAME</th>
                <th>ORDER DATE</th>
                <th>ORDER DESCRIPTION</th>
                <th>STATUS</th>
                <th>MISSING ITEMS</th>
              </tr>
            </thead>
            <tbody>
              {
                open
                ?
                shippingBox['order_id'].map((orders) => {
                  const orderItemObject = {};
                  const remainingItemObject = {};
                  const itemArray = []
                  console.log("sabdsakjn")
                  for(let x of shippingBox['items']){
                    // console.log("x: ", x)
                    if(x.split("/")[0] == orders['orderId']){
                      // console.log("item string: ", x.split("/")[1].split("_")[0])
                      if(itemArray.includes(x.split("/")[1].split("_")[0])){
                        if(x.split("/")[1].split("_")[0] == 'suit' || x.split("/")[1].split("_")[0] == 'tuxedo'){
                          orderItemObject[x.split("/")[1].split("_")[0]] = orderItemObject[x.split("/")[1].split("_")[0]] + 0.5
                        }else{
                          orderItemObject[x.split("/")[1].split("_")[0]] = orderItemObject[x.split("/")[1].split("_")[0]] + 1 
                        }
                      }
                      else{
                        if(x.split("/")[1].split("_")[0] == 'suit' || x.split("/")[1].split("_")[0] == 'tuxedo'){
                          orderItemObject[x.split("/")[1].split("_")[0]] = 0.5
                          itemArray.push(x.split("/")[1].split("_")[0])
                        }else{
                          orderItemObject[x.split("/")[1].split("_")[0]] = 1
                          itemArray.push(x.split("/")[1].split("_")[0])
                        }
                      }
                    }
                  }
                  let complete = false
                  for(let x of orders['order_items']){
                    if(!itemArray.includes(x['item_name'])){
                      remainingItemObject[x['item_name']] = x.quantity
                    }
                    if(x.quantity > orderItemObject[x['item_name']]){
                      remainingItemObject[x['item_name']] = x.quantity - orderItemObject[x['item_name']]
                    }
                  }
                  return(
                    <tr>
                      <td>{orders['orderId']}</td>
                      <td>{orders['customerName']}</td>
                      <td>{orders['OrderDate']}</td>
                      <td style ={{textTransform: "capitalize"}}>{Object.keys(orderItemObject).map(items => orderItemObject[items] + " " + items + " ")}</td>
                      <td>{Object.keys(remainingItemObject).length ? "Partial" : "Complete"}</td>
                      <td style ={{textTransform: "capitalize"}}>{Object.keys(remainingItemObject).map(items => remainingItemObject[items] + " " + items + " ")}</td>
                    </tr>
                  )
                })
                :
                ""
              }
            </tbody>
          </table>
          </div>
          <button type="button" className="custom-btn" onClick={PackagingPDF}>Pdf</button>
        </div>
      </Dialog>
      {success 
      && 
      (
                    <Snackbar
                      open={open1}
                      autoHideDuration={2000}
                      onClose={handleClose}
                    >
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
                    open={open1}
                    autoHideDuration={2000}
                    onClose={handleClose}
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
    </main>
  )
}