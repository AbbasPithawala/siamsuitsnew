import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import { Navigate, useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageMeasurementsFormEdit(){

  const [name, setName] = useState("")
  const [thaiName, setThaiName] = useState("")
  const [productsName, setProductsName] = useState([])
  const [productNamechk, setProductNamechk] = useState([])
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const id = location.pathname.split("/")[3]


  useEffect(()=> {
    const fetchProducts = async() => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})
      setProductsName(res.data.data)
    }
    fetchProducts()
  }, [])

  useEffect(()=>{
    const fetchMeasurement = async() => {
      const res = await axiosInstance.post("/measurement/fetch/" +id, {token:user.data.token})
      setName(res.data.data[0].name)
      setThaiName(res.data.data[0].thai_name)
      setProductNamechk(res.data.data[0].product_id)
    }
    fetchMeasurement()
  }, [])


  const handleCheckboxChange = async(e) =>{
    if(e.target.checked){
        setProductNamechk([...productNamechk, e.target.value])
    }else{
      const updatedSelectedItem = productNamechk.filter(
        (selectedItem) => selectedItem !== e.target.value
      );
      setProductNamechk(updatedSelectedItem);
    }
     
   }


  const handleSubmit = async(e) => {
    e.preventDefault()
    const newMeasurement = {
      measurement:{
       name:name,
       thai_name:thaiName,
       product_id:productNamechk
      },
      token:user.data.token
    }
    if(name =="" || thaiName=="" || productNamechk==""){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill this input!")
    }else{
      const res = await axiosInstance.put("/measurement/update/" +id, newMeasurement)
      if(res.data.status==true){
        setOpen(true)
        setSuccess(true)
        Navigate(`/admin/measurements`);
      }else{
        setOpen(true)
        setError(true)
        setErrorMsg(res.data.message)
      }
    }
  }

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false)
    setOpen(false)
    setError(false)
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
  )
 
    return(
      <main className="main-panel">
        <div className="content-wrapper">
          <div className="order-table manage-page">
            <div className="top-heading-title">
              <strong> Edit Measurements </strong>
              </div>
                <div className="factory-user-from-NM pd-15">       
                 <form onSubmit = {handleSubmit}>
                   <div className="form-group">
                      <div className="col">
                        <div className="searchinput-inner">
                           <p>Measurement Name <span className="red-required">*</span></p>
                           <input className="searchinput" type="text" value={name} onChange={(e) => setName(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col">
                       <div className="searchinput-inner">
                         <p>Thai Measurement Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" value={thaiName} onChange={(e) => setThaiName(e.target.value)}/>
                        </div>
                      </div>
                    <div className="col">
                    <div className="role_block">
                        <h4>Product Name</h4>
                        {productsName.map((productName) => (
                        <label className="full_label">
                        <input type="checkbox" id={`chk${productName.name}`} value={productName._id} checked={productNamechk.includes(productName._id)} onChange={handleCheckboxChange}/>
                        <label htmlFor={`chk${productName.name}`}>{productName.name}</label>
                        </label>
                        ))}
                    </div>
                    </div>  
                    <div className="col savesumitbtnnm">
                      <input type="submit" className="custom-btn" value="SAVE"/>
                    </div>
                  </div>
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
                        Measurement updated successfully!
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
               </form>  
              </div>          
            </div>
        </div>
    </main>
    )
}