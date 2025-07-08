import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import OutlinedInput from '@mui/material/OutlinedInput';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};



export default function ManageProductForm(){

  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const { user } = useContext(Context)
  const [file, setFile] = useState(null);
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false);
  const [processesArray, setProcessesArray] = useState([]);
  const [processes, setProcesses] = useState([]);
  


  
  useEffect(() => {
    fetchProcesses();
  }, []);

  const handleSubmit = async(e) => {
    e.preventDefault()

    
    const newProduct = {
      product:{
       name:productName,
       description:productDescription,
       process: processes 
      },
      token:user.data.token
    }
    if(productName =="" || productDescription=="" || !processes.length > 0){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill this input!")
    }else{
      if(file){
        const data = new FormData();
        const filename = Date.now() + file.name;
        data.append("name", filename);
        data.append("image", file);
        const res = await axiosInstance.post("image/upload", data)
        newProduct.product.image = res.data.data
      }
      const res = await axiosInstance.post("/product/create", newProduct)
      if(res.data.status==true){
        setOpen(true)
        setSuccess(true)
        setProductName("")
        setProductDescription("")
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

  const handleAddProcesses = (event) => {
    const {
      target: { value },
    } = event;
    setProcessesArray(
      typeof value === 'string' ? value.split(',') : value,
    );
  };



  // =====================static function========================
  // =====================static function========================

  const fetchProcesses = async() => {
    const res = await axiosInstance.post("/product/fetchProcess", {
      token: user.data.token,
    });

    // res.data.data.map((process) => {
    //   console.log(process['name'])
    //   processesArray.push(process['name'])
    //   setProcessesArray([...processesArray])
    // })

    setProcesses(res.data.data)
    
  }

  // console.log(processesArray)

  // =================static function ends here=================
  // =================static function ends here=================



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
              <strong> Add Product </strong>
              </div>
                <div className="factory-user-from-NM pd-15">       
                 <form onSubmit = {handleSubmit}>
                    <div className="form-group">
                      <div className="col">
                        <div className="searchinput-inner">
                          <p>Product Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" value={productName} onChange={(e) => setProductName(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col">
                       <div className="searchinput-inner">
                          <p>Product Description <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" value={productDescription} onChange={(e) => setProductDescription(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col">
                        <div className="searchinput-inner">
                          <form  encType="multipart/form-data" >
                           
                            <div className="input-file-outer">
                              <label className='input-file-button' htmlFor="fileInput">CHOOSE FILE</label>
                              {file && <img src={URL.createObjectURL(file)} alt="custom-pic" /> }
                              <input type="file"  name='image' id="fileInput"  className="inputfile-button" onChange={(e) =>setFile(e.target.files[0])}/>
                            </div>
                          </form>
                        </div>
                      </div>  
                    </div>
                    <div className="form-group">
                      <div className="col">
                        <div className="searchinput-inner">
                          <p>Add Process <span className="red-required">*</span></p>
                          <FormControl sx={{ m: 1, width: 300 }}>
                            <Select
                              labelId="demo-multiple-name-label"
                              id="demo-multiple-name"
                              multiple
                              value={processesArray}
                              onChange={handleAddProcesses}
                              input={<OutlinedInput label="Name" />}
                              MenuProps={MenuProps}
                            >
                              {processes.map((process) => {
                                return (
                                <MenuItem
                                  key={process['name']}
                                  value={process['name']}
                                >
                                  {process['name']}
                                </MenuItem>
                              )})}
                          </Select>
                        </FormControl>
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
                        Product created successfully!
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