import React from "react";
import "./admin.css";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import { useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import DeleteIcon from "@mui/icons-material/Delete";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { PicBaseUrl } from "../../../../imageBaseURL";
import { useNavigate } from "react-router-dom";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageProcesses() {
  const { user } = useContext(Context);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [openAddProcessDialogue, setOpenAddProcessDialogue] = useState(false)

  const [productDisplayName, setProductDisplayName] = useState("");
  const [step, setStep] = useState([]);
  const [step1, setStep1] = useState([]);
  const [characters, updateCharacters] = useState([]);
  const [dragItem, updateDragItem] = useState();
  const [fea, setFea] = useState([]);
  const [list, updateList] = useState([]);
  const [list2, updateList2] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [tosterOpen, setTosterOpen] = useState(false);
  const [process, setProcess] = useState({})
  const [processID, setProcessID] = useState("");
  const [processes, setProcesses] = useState([]) 
  const [showProcesses, setShowProcesses] = useState(false);
  const [openEditProcessDialogue, setOpenEditProcessDialogue] = useState(false)
  const navigate = useNavigate();
  const [inputMeasurementList, setInputMeasurementList] = useState([
    {
      stepId: "",
      measurement: "",
    },
  ]);
  const [measurements, setMeasurements] = useState([]);

  const [inputStyleList, setInputStyleList] = useState([
    {
      stepId: "",
      optionValue: "",
      optional: "",
    },
  ]);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
    };
    fetchProducts();
    fetchProcesses();
  }, []);


  
  const handleOpenAddProcessDialogue = () => {
    setOpenAddProcessDialogue(true);
  };

  const handleCloseAddProcessDialogue = () => {
    setOpenAddProcessDialogue(false);
  };

  

  
  const handleClose = () => {
    setOpen(false);
  };

  const handleTosterClose = () => {
    setTosterOpen(false);
  };

  const handleClickOpen2 = (e) => {
    const productMeasurements2 = products.filter((x) => {
      return x._id == e.target.dataset.name;
    });

    setProductDisplayName(productMeasurements2[0].name);


    const justAnArray2 = [];
    for (let x of productMeasurements2[0].features) {
      justAnArray2.push(x.name + "-" + x._id + "-" + x.thai_name);
    }
    updateList2(justAnArray2);
    setOpen2(true);
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDragStart = (index) => {
    updateDragItem(index);
  };

  const handleDragEnter = (e, index) => {
    const newList = [...list];
    const item = newList[dragItem];
    newList.splice(dragItem, 1);
    newList.splice(index, 0, item);
    updateDragItem(index);
    updateList(newList);
  };

  const handleDragStart1 = (index) => {
    updateDragItem(index);
  };

  const handleDragEnter1 = (e, index) => {
    const newList = [...list2];
    const item = newList[dragItem];
    newList.splice(dragItem, 1);
    newList.splice(index, 0, item);
    updateDragItem(index);
    updateList2(newList);
  };

  const handleArrangeMeasurement = async () => {
    const finalArray = [];
    for (let x of list) {
      finalArray.push(x.split("-")[1]);
    }
    
    const res = await axiosInstance.put(
      "/product/updateMeasurements/" + productDisplayName,
      {
        token: user.data.token,
        measurements: finalArray,
      }
      
    );

    if(res.data.status==true){
      setTosterOpen(true)
      setSuccess(true)
      setSuccessMsg(res.data.message);
      setOpen(false);
      const res1 = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res1.data.data);
    }else{
      setTosterOpen(true)
      setError(true)
      setErrorMsg(res.data.message)
    }
  
  };

  const handleArrangeFeatures = async () => {
    const finalArray = [];
    for (let x of list2) {
      finalArray.push(x.split("-")[1]);
    }

    const res = await axiosInstance.put(
      "/product/updateFeatures/" + productDisplayName,
      {
        token: user.data.token,
        features: finalArray,
      }
    );
    if(res.data.status==true){
      setTosterOpen(true)
      setSuccess(true)
      setSuccessMsg(res.data.message);
      setOpen2(false);
      const res1 = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res1.data.data);
    }else{
      setTosterOpen(true)
      setError(true)
      setErrorMsg(res.data.message)
    }
  };

  const handleAddProcess = async() => {
    
    const newProcess = {
      process:{
       name:process['name'],
       thai_name: process['thai_name'],
       description: process['description'],
       price: process['price']
      },
      token:user.data.token
    }
    if(!Object.keys(process).length > 0 || !process['name'].length > 0 || !process['thai_name'].length > 0 || !process['description'].length > 0 || !process['price']){
      setTosterOpen(true)
      setError(true)
      setErrorMsg("Please fill all the input!")
    }else{
  
      const res = await axiosInstance.post("/product/createProcess", newProcess)
      if(res.data.status==true){
        fetchProcesses();
        setTosterOpen(true)
        setSuccess(true)
        setSuccessMsg(res.data.message)
        setProcess({})
        setOpenAddProcessDialogue(false)
     }else{
      setTosterOpen(true)
        setError(true)
        setErrorMsg(res.data.message)
      setProcess({})
      setOpenAddProcessDialogue(false)
      }
    }
  } 
  const handleEditProcess = async() => { 
    
    const newProcess = {
      process:{
       name:process['name'],
       thai_name: process['thai_name'],
       description: process['description'],
       price: process['price']
      },
      token:user.data.token
    }
    if(!Object.keys(process).length > 0 || !process['name'].length > 0 || !process['thai_name'].length > 0 || !process['description'].length > 0 || !process['price']){
      setTosterOpen(true)
      setError(true)
      setErrorMsg("Please fill all the input!")
    }else{
  
      const res = await axiosInstance.post("/product/editProcess/" + processID, newProcess)
      console.log("res: ", res.data)
      if(res.data.status==true){
        fetchProcesses();
        setTosterOpen(true)
        setErrorMsg("")
        setError(false)
        setSuccess(true)
        setSuccessMsg(res.data.message)
        setOpenEditProcessDialogue(false)
        setProcessID("")
        setProcess({})
     }else{
      setTosterOpen(true)
      
      setSuccess(false)
      setSuccessMsg("")
      setError(true)
      setSuccess(false)
      setErrorMsg(res.data.message)
      setProcess({})
      setOpenEditProcessDialogue(false)
      setProcessID("")
      }
    }
  }

  const handleChangeProcessValue = (e) => {
    if(e.target.dataset.name == 'price'){
      process[e.target.dataset.name] = Number(e.target.value)
      setProcess({...process})
    }else{
      process[e.target.dataset.name] = e.target.value
      setProcess({...process})
    }
  }

  const handleOpenEditProcessDialogue = (e, pid) => {
    const thisProcess = processes.filter((pro) => pro['_id'] == pid)
    if(thisProcess.length > 0){
      setOpenEditProcessDialogue(true)
      setProcess({...thisProcess[0]})
      setProcessID(thisProcess[0]['_id'])
    }
  }

  const handleCloseEditProcessDialogue = () =>{   
    setProcess({})
    setProcessID("")
    setOpenEditProcessDialogue(false)
  }

  // =====================static function========================
  // =====================static function========================

  const fetchProcesses = async() => {
    const res = await axiosInstance.post("/product/fetchProcess", {
      token: user.data.token,
    });

    if(res.data.status == true){
      setProcesses(res.data.data)
      setShowProcesses(true)
    }
    
  }
  console.log("processes: " , processes)

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
  );

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Manage Processes</strong>
            <div className="add-btn">
              <button  className="custom-btn" onClick={handleOpenAddProcessDialogue}>
                <i className="fa-solid fa-plus"></i> Add Processes
              </button>         
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>Thai Name</th>
                <th>Price</th>
                <th>Description</th>
                {/* <th>STYLING</th> */}
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {showProcesses ?
                processes.map((proc, key) => (
                  <tr key={key}>
                    <td style={{textTransform: "capitalize"}}>
                    <strong>{proc.name}</strong>
                    </td>
                    <td style={{textTransform: "capitalize"}}>{proc['thai_name']}</td>
                    <td style={{textTransform: "capitalize"}}>{proc['price']}</td>
                    <td style={{textTransform: "capitalize"}}>{proc['description']}</td>
                    <td>
                      <strong>
                        <Button
                          onClick={(e) => handleOpenEditProcessDialogue(e, proc['_id'])}
                          className="custom-btn"

                        >
                          Edit
                        </Button>
                      </strong>
                    </td>
                  </tr>
                ))
                :
                <></>
              }
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" className="dialog-title-head">
        {productDisplayName.toUpperCase()}
        </DialogTitle>
        <DialogContent>
          <div className="modal-box-NM">
            <div className="modal-inner-content">
              <table>
                <thead>
                  <tr>
                    <th> Step ID </th>
                    <th> Measurement Name </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <p>{index + 1}</p>
                      </td>
                      <td>
                        <Stack
                          direction="row"
                          spacing={1}
                          draggable
                          key={index}
                          onDragStart={() => handleDragStart(index)}
                          onDragEnter={(e) => handleDragEnter(e, index)}
                          // onDragLeave={(e) => handleDragLeave(e)}
                          // onDrop={(e) => handleDrop(e)}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          <Chip
                            label={item.split("-")[0] + " | " + item.split("-")[2]}
                            color="primary"
                            variant="outlined"
                            style={{
                              width: "115px",
                              fontSize: "16px",
                              cursor: "grabbing",
                              transition: "all 2.2s",
                            }}
                          />
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="append-inputs-btn">
                <input
                  type="submit"
                  className="custom-btn"
                  onClick={handleArrangeMeasurement}
                  value="Save"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={openAddProcessDialogue} onClose={handleCloseAddProcessDialogue}>
        <DialogTitle>Add Processes</DialogTitle>
        <DialogContent>
                      <div className="col">
                        <div className="searchinput-inner">
                          <p>Process Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="name" value={process ? process['name']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Process Thai Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="thai_name" value={process ? process['thai_name']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Cost <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="price" value={process ? process['price']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Description <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="description" value={process ? process['description']: ""} onChange={handleChangeProcessValue}/>
                        </div>

                      </div>
                
        </DialogContent>
        <DialogActions>
          <button className="custom-btn" onClick={handleCloseAddProcessDialogue}>Cancel</button>
          <button className="custom-btn" onClick={handleAddProcess}>Add Process</button>
        </DialogActions>
      </Dialog>
      <Dialog open={openEditProcessDialogue} onClose={handleCloseEditProcessDialogue}>
        <DialogTitle>Edit Processes</DialogTitle>
        <DialogContent>
                      <div className="col">
                        <div className="searchinput-inner">
                          <p>Process Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="name" value={process ? process['name']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Process Thai Name <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="thai_name" value={process ? process['thai_name']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Cost <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="price" value={process ? process['price']: ""} onChange={handleChangeProcessValue}/>
                        </div>
                        <div className="searchinput-inner">
                          <p>Description <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" data-name="description" value={process ? process['description']: ""} onChange={handleChangeProcessValue}/>
                        </div>

                      </div>
                
        </DialogContent>
        <DialogActions>
          <button className="custom-btn" onClick={handleCloseEditProcessDialogue}>Cancel</button>
          <button className="custom-btn" onClick={handleEditProcess}>Edit Process</button>
        </DialogActions>
      </Dialog>
      {success && (
        <Snackbar open={tosterOpen} autoHideDuration={2000} onClose={handleTosterClose}>
          <Alert
            onClose={handleTosterClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar
          open={tosterOpen}
          autoHideDuration={2000}
          onClose={handleTosterClose}
          action={action}
        >
          <Alert onClose={handleTosterClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
