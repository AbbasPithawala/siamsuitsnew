import React, { useState, useEffect, useContext } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import validator from "validator";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManagePositionForm(){

  const [name, setName] = useState("")
  const [thaiName, setThaiName] = useState("")
  const [description, setDescription] = useState("")
  const [cost, setCost] = useState("")
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState("")
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  
  useEffect(()=> {
    const fetchProducts = async() => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})
      setProducts(res.data.data)
    }
    fetchProducts()
  },[])

  const handleStyleChange = async(value) => {
    setProduct(value)
  }


  const handleSubmit = async(e) => {
    e.preventDefault()
    const newPosition = {
      token:user.data.token,
      name:name,
      thai_name:thaiName,
      cost:cost,
      product:product,
      description:description
    }
    const data = {
      token: user.data.token,
      position :{ 
        name:name,
        thai_name:thaiName,
        cost:cost,
        product:product,
        description:description
      }
    }
    console.log()
    if(name=="" || thaiName=="" || product==""){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill this input!")
    }else{
      const res = await axiosInstance.post("/position/create", data)
      if(res.data.status==true){
        setOpen(true)
        setSuccess(true)
        setName("")
        setThaiName("")
        setCost("")
        setDescription("")
        setProduct("")
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

    setSuccess(false);
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
              <strong> Add Position </strong>
              </div>
                <div className="factory-user-from-NM pd-15">       
                 <form onSubmit = {handleSubmit}>
                   <div className="form-group row">
                   <div className="col-md-4" style={{padding:"0 15px"}}>
                     <div className="searchinput-inner">
                      <p>Product <span className="red-required">*</span></p>
                       <select className="searchinput" value={product} onChange={(e)=>handleStyleChange(e.target.value)}>
                        <option >Select a Product</option>
                        { products.map((product, i)=>(
                          <option key={i} value={product._id}>{product.name.charAt(0).toUpperCase() + product.name.slice(1)}</option>
                        ))}
                      </select>
                     </div>
                    </div>
                      <div className="col-md-4" style={{padding:"0 15px"}}>
                        <div className="searchinput-inner">
                           <p>Position Name <span className="red-required">*</span></p>
                           <input className="searchinput" type="text" value={name} onChange={(e) => setName(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col-md-4" style={{padding:"0 15px"}}>
                       <div className="searchinput-inner">
                         <p>Thai Position Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" value={thaiName} onChange={(e) => setThaiName(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col-md-4" style={{padding:"0 15px"}}>
                      <div className="searchinput-inner">
                          <p>Description</p>
                          <input className="searchinput" type="text" value={description} onChange={(e) => setDescription(e.target.value)}/>
                          </div>
                      </div>
                      <div className="col-md-4" style={{padding:"0 15px"}}>
                      <div className="searchinput-inner">
                        <p>Cost</p>
                        <input className="searchinput" type="text" value={cost} onChange={(e) => setCost(e.target.value)} />
                      </div>
                    </div>
                   </div>
                   <div className="form-group row">
     
                    <div className="col-sm-4 savesumitbtnnm">
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
                        Position created successfully!
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