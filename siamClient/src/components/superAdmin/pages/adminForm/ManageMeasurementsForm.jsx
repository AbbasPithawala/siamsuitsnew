import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useParams, useNavigate } from "react-router-dom";
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageMeasurementsForm(){
  const navigate = useNavigate();
  const [name, setName] = useState("")
  const [thaiName, setThaiName] = useState("")
  const [productsName, setProductsName] = useState([])
  const [productName, setProductName] = useState([])
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)


  useEffect(()=> {
    const fetchProducts = async() => {
        const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})
        setProductsName(res.data.data)
    }
    fetchProducts()
  }, [])


  const handleCheckboxChange = async(e) =>{
    if(e.target.checked){
        setProductName([...productName, e.target.value])
    }else{
      const updatedSelectedItem = productName.filter(
        (selectedItem) => selectedItem !== e.target.value
        
      );
      setProductName(updatedSelectedItem);
    }
     
   }


  const handleSubmit = async(e) => {
    e.preventDefault()
    const newMeasurement = {
      measurement:{
       name:name,
       thai_name:thaiName,
       product_id:productName
      },
      token:user.data.token
    }
    if(name =="" || thaiName==""){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill all this input!")
    }else{
      const res = await axiosInstance.post("/measurement/create", newMeasurement)
      if(res.data.status==true){
        setOpen(true)
        setSuccess(true)
        setName("")
        setThaiName("")
        setProductName([]);
        // navigate(`/admin/measurements`);
        // setTimeout(() => {
        //   navigate(`/admin/measurements`);
        // }, );
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
              <strong> Add Measurements </strong>
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
                        {productsName.map((productName, i) => (
                        <label className="full_label" key={i}>
                        <input  type="checkbox"  id={`chk${productName.name}`} value={productName._id} onChange={handleCheckboxChange}/>
                        <label  htmlFor={`chk${productName.name}`}>{productName.name}</label>
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
                        Measurement created successfully!
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