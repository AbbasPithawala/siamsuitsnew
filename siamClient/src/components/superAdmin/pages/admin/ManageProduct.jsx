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

export default function ManageProduct() {
  const { user } = useContext(Context);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);

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
  }, []);


  
  const handleClickOpen3 = () => {
    navigate("/admin/process")
  };

  const handleAddNewProductNavigate = () => {
    navigate("/admin/addProduct")
  }



  

  const handleClickOpen = async (e) => {
    const productMeasurements = products.filter((x) => {
      return x._id == e.target.dataset.name;
    });
    console.log("fdsfsd")
    console.log("pm: ",productMeasurements[0])
    setProductDisplayName(productMeasurements[0].name);

    const justAnArray = [];
    for (let x of productMeasurements[0].measurements) {
      justAnArray.push(x.name + "-" + x._id + "-" + x['thai_name']);
    }
    updateList(justAnArray);
    setOpen(true);
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
            <strong>Manage Product</strong>
            <div className="add-btn">
              <button onClick={handleAddNewProductNavigate} className="custom-btn" style={{marginRight: "5px"}}>
                <i className="fa-solid fa-plus"></i> Add New Product
              </button>
              <button  className="custom-btn" onClick={handleClickOpen3}>
                <i className="fa-solid fa-plus"></i> Manage Processes
              </button>         
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>DESCRIPTION</th>
                <th>IMAGE</th>
                <th>MEASUREMENTS</th>
                <th>STYLING</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, key) => (
                <tr key={key}>
                  <td>
                  <strong>{product.name.charAt(0).toUpperCase() + product.name.slice(1)}</strong>
                  </td>
                  <td>{product.description.charAt(0).toUpperCase() + product.description.slice(1)}</td>
                  <td>
                    {product.image == null ? (
                      "No Image"
                    ) : (
                      <img
                        src={PicBaseUrl + product.image}
                        style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          margin: "4px",
                          objectFit: "cover",
                          objectPosition: "center rigth",
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <strong>
                      <button
                        key={key}
                        onClick={(e) => handleClickOpen(e)}
                        data-name={product._id}
                        className="manage-btn"
                      >
                        Manage
                      </button>
                    </strong>
                  </td>
                  <td>
                    <strong>
                      <button
                        key={key}
                        onClick={(e) => handleClickOpen2(e)}
                        data-name={product._id}
                        className="manage-btn"
                      >
                        Manage
                      </button>
                    </strong>
                  </td>
                  <td>
                    <strong>
                      <Link
                        to={`/admin/addProduct/${product._id}`}
                        className="action"
                      >
                        Edit
                      </Link>
                    </strong>
                  </td>
                </tr>
              ))}
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
      <Dialog
        open={open2}
        onClose={handleClose2}
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
                    <th> Style Option </th>
                  </tr>
                </thead>
                <tbody>
                  {list2.map((item, index) => (
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
                          onDragStart={() => handleDragStart1(index)}
                          onDragEnter={(e) => handleDragEnter1(e, index)}
                          // onDragLeave={(e) => handleDragLeave(e)}
                          // onDrop={(e) => handleDrop(e)}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          <Chip
                            label={item.split("-")[0] + " | " + item.split("-")[2]}
                            color="primary"
                            variant="outlined"
                            style={{
                              width: "auto",
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
                  onClick={handleArrangeFeatures}
                  value="Save"
                />
              </div>
            </div>
          </div>
        </DialogContent>
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
