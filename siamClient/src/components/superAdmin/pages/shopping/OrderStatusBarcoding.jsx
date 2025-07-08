import React, {useEffect, useState, useContext, useRef} from "react";
import { useNavigate } from "react-router-dom";
import "./shipping.css";
import { Button } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import { axiosInstance } from "./../../../../config";
import { Context } from "./../../../../context/Context";
import CancelIcon from '@mui/icons-material/Cancel';
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function OrderStatusBarcoding() {
  const [qrCodeStatus, setQRCodeStatus] = useState("");
  const [open2, setOpen2] = useState(false);
  const [trackInput, setTrackInput] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [open3, setOpen3] = useState(false);  
  const [allRetailers, setAllRetailers] = useState([]);
  const { user } = useContext(Context);
  const [retailer, setRetailer] = useState("");
  const [shippingBoxName, setShippingBoxName] = useState("");
  const [shippingBox, setShippingBox] = useState({});
  const [shippingBoxes, setShippingBoxes] = useState([]);
  const[showQRCodeInput, setShowQRCodeInput] = useState(false);
  const [QRInput, setQRInput] = useState("");
  const [orderQRInput, setOrderQRInput] = useState("");
  const [itemQuantityObject, setItemQuantityObject] = useState({});
  const [retailerID, setRetailerID] = useState("");
  const [QRCodeValue, setQRCodeValue] = useState("");
  const [QRCodeOpen, setQRCodeOpen]  = useState(false);
  const [thisOrder, setThisOrder] = useState({});
  let htmlElement = useRef(null);
  const [success, setSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();


  useEffect(() => {
    fetchRetailers();
  }, [])
 
  const handleClickOpen = () => {
    const itemArray = {}
    if(shippingBox['items'].length > 0)
    { 
      for(let x of shippingBox['items']){
        const itemName = x.split("/")[1].split("_")[0]
        if(Object.keys(itemArray).length > 0){
          if(!Object.keys(itemArray).includes(itemName)){
            itemArray[itemName] = 1
           }else{
            itemArray[itemName] = itemArray[itemName] + 1 
           }
        }else{
          itemArray[itemName] = 1
        }
      }
    }
    setItemQuantityObject(itemArray)
    setOpen2(true);
  };


  const handleClose2 = async() => {
    if(!shippingBox['tracking_code'] || !shippingBox['items'].length > 0){
      setOpen(true)
      setSuccess(false)
      setErrorMsg("Please provide a tracking code for this box")
      setError(true)
      setTrackInput(true)
    }
    else{

      updateShippingBox({isClosed: true})
      fetchShippingBoxes(retailer['_id'])
      setTimeout(() => {
        navigate("/shipping/shippingboxreport")
        // window.location.reload()
      }, 2000)
      
    }
  };

  const handleClose3 = () => {
    setOpen3(false);
  };

  const handleCreateShippingBox =() => {
    console.log(retailer, shippingBoxName)
    if(retailer && shippingBoxName){
      createShippingBox()
    }else{

    }
  }

  console.log(retailer)

  const handleSelectRetailer = (e) => {
    const ret = allRetailers.filter((retail) => retail['_id'] === e.target.value)
    setRetailer(ret[0])
    fetchShippingBoxes(e.target.value)
  }

  const handleOpenQRCodeInput = (e) => {
    setShowQRCodeInput(true)
    const shippingBoxObject = shippingBoxes.filter((box) => box['_id'] == e.target.value)
    setShippingBox(shippingBoxObject[0])
  }

  const handleQRCodeInput = async(e) => {
    console.log("checking: ", QRInput)
    if(QRInput.indexOf("-") == "-1" || QRInput.length < 8){
      setOpen(true)
      setSuccess(false)
      setErrorMsg("Please provide a valid input")
      setError(true)
    }else{
      const res = await axiosInstance.post("/shipping/addItem", {
        token: user.data.token,
        box:{
          retailer,
          itemCode: QRInput,
          shippingBox: shippingBox
        }
      })

      if(res.data.status == true){
        const statusChange={
          token: user.data.token,
          order_status: "Sent"
        }
        const res2 = await axiosInstance.put(
          `/customerOrders/updateStatusWithOrderID/${QRInput.split("/")[0]}`,
          statusChange
        );
        if(res2.data.status == true){

          setOpen(true)
          setSuccess(true)
          setErrorMsg("")
          setError(false)
          setSuccessMsg(res.data.message)
          setShippingBox(res.data.data)
        }        
      }else{

        setOpen(true)
        setSuccess(false)
        setErrorMsg(res.data.message)
        setError(true)
      }
    }
  }

  const handleOrderQRCodeInput = async(e) =>{
    console.log("order input: ", orderQRInput)
    if(orderQRInput.indexOf("-") == "-1" || orderQRInput.length < 6){
      setOpen(true)
      setSuccess(false)
      setErrorMsg("Please provide a valid input")
      setError(true)
    }else{
      const res = await axiosInstance.post("/shipping/addOrder", {
        token: user.data.token,
        box:{
          retailer,
          orderCode: orderQRInput,
          shippingBox: shippingBox
        }
      })

      if(res.data.status == true){

        const statusChange={
          token: user.data.token,
          order_status: "Sent"
        }
        const res2 = await axiosInstance.put(
          `/customerOrders/updateStatusWithOrderID/${orderQRInput}`,
          statusChange
        );
        if(res2.data.status == true){
          setOpen(true)
          setSuccess(true)
          setErrorMsg("")
          setError(false)
          setSuccessMsg(res.data.message)
          setShippingBox(res.data.data)   
        }     
      }else{

        setOpen(true)
        setSuccess(false)
        setErrorMsg(res.data.message)
        setError(true)
      }
    }
  }

  const handleChangeQRCodeStatus = (e) => {
    setQRCodeStatus(e.target.value)
    setShowQRCodeInput(false)
  }

  const handleSubmitTrackingCode = ()=> {
   updateShippingBox({tracking_code : trackingCode}) 
  }

  const generateQR = async (e, text) => {
    console.log(text)
      const res = await axiosInstance.post('/customerOrders/fetch', {
        token: user.data.token,
        order_id: text.split("/")[0]
      })

        const res2 = await axiosInstance.post('/groupOrders/fetch', {
          token: user.data.token,
          order_id: text.split("/")[0]
        })



      if((res.data.status == true && res.data.data.length == 1) || (res2.data.status == true && res2.data.data.length == 1)){
        const itemArray1 = text.split("/")[1]
        const itemArray = itemArray1.split("_")
        let itemNumber = ""
        let itemQuantity = ""
        let itemName = ""
        if(itemArray.length == 2){
          itemNumber = Number(itemArray[1]) + 1
          itemName = itemArray[0]
        }else if(itemArray.length == 3){
          itemNumber = Number(itemArray[2]) + 1
          itemName = itemArray[0]
        }
        

        for(let x of res.data.data[0]['order_items']){
          if(x['item_name'] == itemName){
            itemQuantity = x['quantity']
          }
        }
      let html = '<div style="width:200px;">'+
      '<p style="font-size:8px; font-weight:700;  text-align:center;">' + res.data.data[0]["orderId"] +  '</p>'+
      '<p style="font-size:8px; font-weight:700; text-align:center;">'+ res.data.data[0]["customerName"] +'</p>'+
      '<p style="font-size:8px; font-weight:700;  text-align:center;">'+ itemNumber + " / " + itemQuantity + itemName +'</p>'+
      '</div>';

    //   let doc = new jsPDF('l','px',[200, 65]);
    // doc.html(html, {
    //   async callback(doc) {
    //     window.open(doc.output("bloburl"), "_blank");
    //   },
    // });
    let doc = new jsPDF('l', 'px', [200, 65]);

doc.html(html, {
  async callback(doc) {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

    // Open popup window
    const popup = window.open("", "pdfPopup", "width=800,height=600");

    if (popup) {
      // Write HTML that embeds the PDF
      popup.document.write(`
        <html>
          <head><title>PDF Preview</title></head>
          <body style="margin:0">
            <embed width="100%" height="100%" src="${blobUrl}" type="application/pdf" />
          </body>
        </html>
      `);
    } else {
      alert("Popup blocked! Please allow popups for this site.");
    }
  }
});
      }else{
      }
      setQRCodeValue(text)
  }

  const handlePrintQR = () => {
    let doc = new jsPDF('l','mm',[107, 35.0]
    );
    doc.html(htmlElement.current, {
      async callback(doc) {
        window.open(doc.output("bloburl"), "_blank");
      },
    });
  };

  
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false)
    setOpen(false)
    setError(false)
  }


  // ===========static function=================
  // ===========================================

  const fetchRetailers = async () => {
    const res = await axiosInstance.post("/retailer/fetchAll", {
      token: user.data.token,
    });
    setAllRetailers(res.data.data);
  };

  const createShippingBox = async() => {
    const res = await axiosInstance.post("/shipping/create", {
      token: user.data.token,
      shippingBox: {name: shippingBoxName, retailer: retailerID}
    })

    if(res.data.status == true){
      setOpen(true)
      setSuccess(true)
      setErrorMsg("")
      setError(false)
      setSuccessMsg("Shipping Box created successfully!.")
      handleClose3()
      fetchShippingBoxes(retailerID)
    }
  }
  
  const fetchShippingBoxes = async(id) => {
    const res = await axiosInstance.post("/shipping/fetch/" + id, {
      boxType: false,
      token:user.data.token
    })
    if(res.data.status == true){
      setShippingBoxes(res.data.data)

    }else{
      setShippingBoxes([]);
      setOpen(true)
      setError(true)
      setSuccess(false)
      setErrorMsg(res.data.message)
    }

  }

  const updateShippingBox = async(body) => {
    const res  = await axiosInstance.put("/shipping/update/" + shippingBox['_id'], {
      token: user.data.token,
      shippingBox: body
    })
    if(res.data.status == true){
      setOpen(true)
      setSuccess(true)
      setSuccessMsg("Box has been updated!.")
      setError(false)
      setShippingBox(res.data.data[0])
      setOpen2(false)
    }else{
      setOpen(true)
      setError(true)
      setSuccess(false)
      setErrorMsg(res.data.message)
    }
  }

  const fetchOrder = async(order_id) => {
    const res = await axiosInstance.post('/customerOrders/fetch', {
      token: user.data.token,
      order_id: order_id
    })

    if(res.data.status == true && res.data.data.length == 1){
      setThisOrder(res.data.data[0])
    }else{
      setThisOrder({})
    }
  }

  // ===========================================
  // ===========================================


  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table managemeasurement-page">
          <div className="top-heading-title">
            <strong>Manage Barcoding</strong>
          </div>
          <div className="searchstyle searchstyle-shipping">
            <div className="searchstyle-shipping2">
            <div className="searchinput-inner">
              <p>QR Code Status</p>
              <select
                className="searchinput"
                onChange={(e) => handleChangeQRCodeStatus(e)}
              >
                <option value="">Select Qr Code Status</option>
                <option value="generateQR">Generate QR</option>
                <option value="shipping">Shipping</option>
              </select>
            </div>
            {qrCodeStatus == "shipping" ? (
              <div className="searchinput-inner">
                <p>Retailer Name</p>
                <select className="searchinput" onChange={(e) => handleSelectRetailer(e)}>
                  <option value="">Select Retailer</option>
                  {
                  allRetailers
                  ?
                  allRetailers.map((retailer) => {
                  return(
                    <option key ={retailer['_id']} value={retailer['_id']}>{retailer['retailer_name']}</option>
                  )
                })
                :
                <></>}
                </select>
              </div>
            ) : (
              <div className="searchinput-inner">
                <p>QR Code</p>
                <input
                  type="text"
                  className="searchinput"
                  placeholder="Product QR Code"
                  onChange = {(e) => setQRCodeValue(e.target.value)}
                />
                <button type="button" className="custom-btn" onClick={(e) => generateQR(e, QRCodeValue)}>
                  Submit
                {/* <i className="fa-solid fa-search"></i> */}
              </button>
              </div>
            )}
            </div>
            <div className="searchstyle-shipping2">
            {
              showQRCodeInput && qrCodeStatus=="shipping"
              ?
              <div className="searchinput-inner">
                <p>QR Code</p>
                <input
                  type="text"
                  className="searchinput"
                  placeholder="Product QR Code"
                  onChange={(e) => setQRInput(e.target.value)}
                />

              <button type="button" className="custom-btn" onClick={handleQRCodeInput}>
                <i className="fa-solid fa-search"></i>
              </button>
              </div>
              :
              <></>
            }

            </div>
            <div className="searchstyle-shipping2">
              

          {
              showQRCodeInput && qrCodeStatus=="shipping"
              ?
              <div className="searchinput-inner">
                <p>Add Complete Order</p>
                <input
                  type="text"
                  className="searchinput"
                  placeholder="Order QR Code"
                  onChange={(e) => setOrderQRInput(e.target.value)}
                />

              <button type="button" className="custom-btn" onClick={handleOrderQRCodeInput}>
                <i className="fa-solid fa-search"></i>
              </button>
              </div>
              :
              <></>
            }
            </div>

            <div className="searchinput-inner">
              
              {qrCodeStatus == "shipping" && (
                <button
                  type="button"
                  className="custom-btn"
                  style={{ marginLeft: "10px" }}
                  onClick={() => setOpen3(true)}
                >
                  Add New Shipping Box
                </button>
              )}
            </div>
          </div>
        </div>
        {qrCodeStatus == "shipping" && shippingBoxes.length > 0 
        ?
        <div>
        <div className="top-heading-title">
          <strong>OPEN SHIPPING BOXES</strong>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Box Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {shippingBoxes.length > 0
            ?
          shippingBoxes.map((box) => {
           return (
            <tr key={box['_id']}>
              <td>
                <input type="radio" name="shippinBoxes" id={box['_id']} value={box['_id']} onClick={handleOpenQRCodeInput}/>
              </td>
              <td>{box['name']}</td>
              <td>
                <button
                  type="button"
                  className="custom-btn"
                  onClick={handleClickOpen}
                >
                  Close
                </button>
              </td>
            </tr>
           )
          })
        :
        <></>}
          </tbody>
        </table>
      </div>
      : 
      <></>}
      </div>
      <Dialog
        open={open2}
        onClose={handleClose2}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div>
        <div className="top-heading-title">
            <strong>Shipment Information </strong>
            <span><CancelIcon style={{color: "#1C4D8F"}} onClick={(e) => setOpen2(false)}/></span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Product</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody className="manage-rule">
           {
            Object.keys(itemQuantityObject).length > 0
            ?
            Object.keys(itemQuantityObject).map((iqo, index) => {
              return (
                <tr>
                  <td>{index + 1}</td>
                  <td>{iqo}</td>
                  <td>{itemQuantityObject[iqo]}</td>

                </tr>
              )
            })
            :
            <></>
           }
          </tbody>
        </table>
        {trackInput == false ? (
          <button
            type="button"
            className="custom-btn"
            onClick={() => setTrackInput(true)}
          >
            SHIPPING TRACKING INFO
          </button>
        ) : (
          <div className="searchinput-inner">
            <input
              type="text"
              className="searchinput"
              placeholder="SHIPMENT TRACKING CODE"
              onChange = {(e) => setTrackingCode(e.target.value)}
              value={shippingBox['tracking_code']}
            />
            <button type="button" className="custom-btn" onClick = {handleSubmitTrackingCode}>
              Submit
            </button>
          </div>
        )}
        </div>
        <DialogActions>
          <Button className="custom-btn" onClick={handleClose2}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={open3}
        onClose={handleClose3}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div>
          <div className="top-heading-title">
            <strong>Add New Shipping Box </strong>
          </div>

          <div className="admin-from-style-NM">
            <div className="form-group">
              <label>
                Shipping Box Name <span className="red-required">*</span>
              </label>
              <input type="text" onChange={(e) => setShippingBoxName(e.target.value)} className="searchinput" />
            </div>
            <div className="form-group row">
              <div className="col-md-4 col-sm-4 col-xs-12">
                <div className="role_block">
                  <h4>Retailer Name</h4>
                  {
                    allRetailers
                    ? 
                    allRetailers.map((retailer) => {
                      return (
                      <label key ={retailer['_id']} htmlFor={retailer['_id']} className="full_label">
                      <input
                        type="radio"
                        id={retailer['_id']}
                        value={retailer['_id']}
                        name="retailer"
                        onChange={(e) => setRetailerID(e.target.value)}
                      />
                      {retailer['retailer_name']}
                    </label>
                      )
                    })
                    :
                    <></>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="custom-btn" onClick = {() => handleCreateShippingBox()}>
          Create Box
        </button>
      </Dialog>

      <Dialog
        open={QRCodeOpen}
        onClose={() => setQRCodeOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        {
        Object.keys(thisOrder).length > 0
        ?
        <>
        <div>
          <div className="top-heading-title">
            <strong>QR Codes </strong>
          </div>
          <div ref={htmlElement} style={{marginBottom:"0px"}}>
            <div style={{display: "flex", alignItems:"center", flexDirection:"column", justifyContent:"center", gap:"5px"}}>
              <p style={{margin:"0", fontSize:"5px"}}>{thisOrder["orderId"] + "( " + thisOrder["customerName"] + ")"} </p>
              <p style={{margin:"0", fontSize:"5px"}}>{QRCodeValue}</p>
              
            </div>
          </div>
        </div>
        <button type="button" className="custom-btn" onClick={handlePrintQR}>
          Print
        </button>
        </>
        :
        <div>
          Not a Valid OrderID
        </div>
        }
      </Dialog>
      {success && (
                    <Snackbar
                      open={open}
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
                    open={open}
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
  );
}
