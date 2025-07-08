import React from "react";
import "./admin.css";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
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
import FadeLoader from "react-spinners/FadeLoader";
import Pagination from 'rc-pagination';
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageMeasurements() {
  const [measurements, setMeasurements] = useState([]);
  const { user } = useContext(Context);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [measurementId, setMeasurementId] = useState("");
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);



  useEffect(()=> {
    const fetchMeasurements = async () => {
      const res1 = await axiosInstance.post("/measurement/fetchAll/0/0", {token:user.data.token})
      const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})


      // console.log(res1.data.data)

      const newArray = res1.data.data.map((measurement)=>{
        const newSubArray = []
        const oneMoreArray = []
        // console.log("kjasdasnd",measurement.product_id)
        if(measurement.product_id.length > 0){
          measurement.product_id.map((productID)=>{
            res.data.data.map((products)=>{
              if(products._id == productID){
                newSubArray.push(products.name)
                // console.log(newSubArray)
              }
            })
            measurement.product_name = newSubArray
            oneMoreArray.push(measurement)
            
          })
        }else{
          oneMoreArray.push(measurement)
        }
       
        return oneMoreArray
      })
      setMeasurements(newArray)
    }
    fetchMeasurements()
  }, [])
measurements.map((measurement)=>{
  console.log("measurement: ", measurement)
})

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
      setLoading(false);
    };
    fetchProducts();
  }, []);
  // console.log(measurements);

  // const handleSearchSubmit = async() => {
  //   if(productId == "all"){
  //     const res1 = await axiosInstance.post("/measurement/fetchAll/0/0", {token:user.data.token})
  //     const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})

  //     const newArray = res1.data.data.map((measurement)=>{
  //       const newSubArray = []
  //       const oneMoreArray = []
  //       measurement.product_id.map((productID)=>{
  //         res.data.data.map((products)=>{
  //           if(products._id == productID){
  //             newSubArray.push(products.name)
  //           }
  //         })
  //         measurement.product_name = newSubArray
  //         oneMoreArray.push(measurement)
  //       })
  //       return oneMoreArray
  //     })
  //     setMeasurements(newArray)
  //   }else{
    
  //     const res1 = await axiosInstance.post("/measurement/fetchMeasurement/" + productId, {token:user.data.token})
  //     const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})
  //     let newSubArray = [];
  //     let oneMoreArray = [];
  //     if(res1.data.data) {
  //       const newArray = res1.data.data.map((measurement) => {
  //         measurement.product_id.map((productID) => {
  //           res.data.data.map((products) => {
  //             if (products._id == productID) {
  //               newSubArray.push(products.name);
  //             }
  //           });
  //           measurement.product_name = newSubArray;
  //           oneMoreArray.push(measurement);
  //         });
  //         return oneMoreArray;
  //       });
  //       setMeasurements(newArray);
  //     } else {
  //       setMeasurements(newSubArray);
  //     }

  //   }
  // }


  const handleSearchSubmit = async() => {

    if(productId==="all"){
      const res1 = await axiosInstance.post("/measurement/fetchAll/0/0", {token:user.data.token})
      const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})

      const newArray = res1.data.data.map((measurement)=>{
        const newSubArray = []
        const oneMoreArray = []
        measurement.product_id.map((productID)=>{
          res.data.data.map((products)=>{
            if(products._id == productID){
              newSubArray.push(products.name)
            }
          })
          measurement.product_name = newSubArray
          oneMoreArray.push(measurement)
        })
        return oneMoreArray
      })
      setMeasurements(newArray)
    }else{
      const res1 = await axiosInstance.post("/measurement/fetchMeasurement/" + productId, {token:user.data.token})
      const res = await axiosInstance.post("/product/fetchAll/0/0", {token:user.data.token})
      
      if(res1.data.data == null){
        setOpen(true)
        setError(true)
        setErrorMsg(res1.data.message)
      }else{
        const newArray = res1.data.data.map((measurement)=>{
          const newSubArray = []
          const oneMoreArray = []
          measurement.product_id.map((productID)=>{
            res.data.data.map((products)=>{
              if(products._id == productID){
                newSubArray.push(products.name)
              }
            })
            measurement.product_name = newSubArray
            oneMoreArray.push(measurement)
          })
          return oneMoreArray
        })
        setMeasurements(newArray)
      }
    }
  }  

  

  const handleClickOpen = (id) => {
    console.log(id)
    setMeasurementId(id);
    setOpen2(true);
    
  };



  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDelete = async () => {
    console.log(measurementId)
    const res1 = await axiosInstance.post(
      "/measurement/delete/" + measurementId,
      { token: user.data.token }
    );
 
    if (res1.data.status == true) {
      const res1 = await axiosInstance.post("/measurement/fetchAll/0/0", {
        token: user.data.token,
      });
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });

      const newArray = res1.data.data.map((measurement) => {
        const newSubArray = [];
        const oneMoreArray = [];
        measurement.product_id.map((productID) => {
          res.data.data.map((products) => {
            if (products._id == productID) {
              newSubArray.push(products.name);
            }
          });
          measurement.product_name = newSubArray;
          oneMoreArray.push(measurement);
        });
        return oneMoreArray;
      });
      setMeasurements(newArray);
      setOpen2(false);
      setOpen(true);
      setSuccess(true);
      setSuccessMsg(res1.data.message);
    } else {
      setOpen(true);
      setError(true);
      setErrorMsg(res1.data.message);
    }
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
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

  return loading ? (
    <>
      <div className="spinnerStyle">
        <FadeLoader color="#1d81d2" />
      </div>
    </>
  ) : (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Manage Measurements</strong>
            <Link to="/admin/addMeasurement" className="custom-btn">
              {" "}
              <i className="fa-solid fa-plus"></i> Add New Measurements{" "}
            </Link>
          </div>
          <div className="searchstyle">
            <p>Select Product</p>
            <select
              name="product"
              id="product"
              className="searchinput"
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="all">Select a Product</option>
              {products.map((product, i) => (
              <option key={i} value={product._id}>
                   {product.name.charAt(0).toUpperCase() + product.name.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="custom-btn"
              style={{ marginLeft: "20px" }}
            >
              {" "}
              <i className="fa-solid fa-search"></i>
            </button>
          </div>
          {measurements.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>MEASUREMENT NAME</th>
                  <th>THAI MEASUREMENT NAME</th>
                  <th>PRODUCT NAME</th>
                  <th>OPTION</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((measurement, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{measurement[0].name.charAt(0).toUpperCase() + measurement[0].name.slice(1)}</td>
                    <td>{measurement[0].thai_name.charAt(0).toUpperCase() + measurement[0].thai_name.slice(1)}</td>
                    <td>
                      <strong>{measurement[0].product_name
                      ?
                      measurement[0].product_name.join(",  ")
                      :
                      "---"
                      }</strong>
                    </td>
                    <td>
                      <strong>
                        <Link
                          to={`/admin/addMeasurement/${measurement[0]._id}`}
                          className="action"
                        >
                          Edit
                        </Link>{" "}
                        |{" "}
                        <button
                          onClick={() => handleClickOpen(measurement[0]._id)}
                          className="delete"
                        >
                          Delete
                        </button>
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <h4 style={{ marginLeft: "10px" }}>No data added yet</h4>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={open2}
        onClose={handleClose2}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
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
        <Snackbar
          open={open}
          autoHideDuration={2000}
          onClose={handleClose}
          action={action}
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
          action={action}
        >
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
