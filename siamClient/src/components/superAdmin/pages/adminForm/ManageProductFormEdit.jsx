import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import { useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import OutlinedInput from '@mui/material/OutlinedInput';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { PicBaseUrl } from "../../../../imageBaseURL";
import DeleteIcon from '@mui/icons-material/Delete';

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




export default function ManageProductFormEdit() {


  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const { user } = useContext(Context);
  const [file, setFile] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const id = location.pathname.split("/")[3];
  const [processes, setProcesses] = useState([]);
  const [processesArray, setProcessesArray] = useState([]);
  

  useEffect(() => {
    const fetchProduct = async () => {
      const res = await axiosInstance.post("/product/fetch/" + id, {
        token: user.data.token,
      });
      setProductName(res.data.data[0].name);
      setProductDescription(res.data.data[0].description);
      setProductImage(res.data.data[0].image);
      setProcessesArray(res.data.data[0]['process'])
    
    };
    fetchProduct();
    fetchProcesses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newProduct = {
      product: {
        name: productName,
        description: productDescription,
        process: processesArray 
      },
      token: user.data.token,
    };
    
    if (productName == "" || productDescription == "" || !processes.length > 0) {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      if (file) {
        const data = new FormData();
        const filename = Date.now() + file.name;
        data.append("name", filename);
        data.append("image", file);
        const res = await axiosInstance.post("image/upload", data);
        newProduct.product.image = res.data.data
      }
      const res = await axiosInstance.put("/product/update/" + id, newProduct);
      if (res.data.status == true) {
        setOpen(true);
        setSuccess(true);
      } else {
        setOpen(true);
        setError(true);
        setErrorMsg(res.data.message);
      }
    }

  };
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };
  const handleAddProcesses = (event) => {
    setProcessesArray(event.target.value)
    // const {
    //   target: { value },
    // } = event;
    // setProcesses(
    //   // On autofill we get a stringified value.
    //   typeof value === 'string' ? value.split(',') : value,
    // );
  };

  const handleEmptyProcesses = () => {
    setProcessesArray([])
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

  // =====================static function========================
  // =====================static function========================

  const fetchProcesses = async() => {
    const res = await axiosInstance.post("/product/fetchProcess", {
      token: user.data.token,
    });

    setProcesses(res.data.data)
    
  }

  // =================static function ends here=================
  // =================static function ends here=================

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Edit Product </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Product Name <span className="red-required">*</span>
                    </p>
                    <input
                      className="searchinput"
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Product Description{" "}
                      <span className="red-required">*</span>
                    </p>
                    <input
                      className="searchinput"
                      type="text"
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <form encType="multipart/form-data">
                      <div className="input-file-outer">
                        <label
                          className="input-file-button"
                          htmlFor="fileInput"
                        >
                          CHOOSE FILE
                        </label>
                        {file ? (
                          <img src={URL.createObjectURL(file)} alt="" />
                        ) : productImage == null ? (
                          <></>
                        ) : (
                          <img
                            src={PicBaseUrl + productImage}
                            alt=""
                            style={{ height: 100, width: 100 }}
                          />
                        )}
                        <input
                          type="file"
                          name="image"
                          id="fileInput"
                          className="inputfile-button"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="form-group">
                      <div className="col" >
                        {/* style={{display: "flex", flexDirection:"row", alignItems:"center"}} */}
                        <div className="searchinput-inner">
                          <p>Add Process <span className="red-required">*</span></p>
                          <div style={{display: "flex", flexDirection:"row", alignItems:"center", marginRight:"20px"}}>
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
                              {
                              processes.map((process) => {
                                return(
                                  <MenuItem
                                  key={process['name']}
                                  value={process['name']}
                                >
                                  {process['name']}
                                </MenuItem>
                              )})
                            }
                            </Select>
                          </FormControl>
                       
                          <Button className="custom-btn" style={{}} onClick={(e) => handleEmptyProcesses(e)}>Remove</Button>
                          </div>
                        </div>
                      </div>
                      <div className="col">
                        <div className="searchinput-inner">
                          <p>Processes <span className="red-required">*</span></p>
                          <section>
                            <ul>
                              {processesArray
                              ?
                              processesArray.map((process, index) => {
                                return (
                                  <li key ={index}><b>{process}</b></li>
                                )
                              })
                            :
                            <></>}
                            </ul>
                          </section>
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
                    Product updated successfully!
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
  );
}
