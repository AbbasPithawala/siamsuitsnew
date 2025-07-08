import React from "react";
import "./admin.css";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
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

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageStylingOption() {
  const [features, setFeatures] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const { user } = useContext(Context);
  const [styleOptionId, setStyleOptionId] = useState("");
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [featuresArray, setFeaturesArray] = useState([]);

  useEffect(() => {
    const fetchFeatures = async () => {
      const res1 = await axiosInstance.post("/feature/fetchAll/0/0", {
        token: user.data.token,
      });
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
    };
    fetchFeatures();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      let productsArray = [];
      for (let x of res.data.data) {
        for (let y of x["features"]) {
          console.log(y);
          var productObject = {};
          productObject.featureName = y.name;
          productObject.productName = x.name;
          productObject.featureThaiName = y.thai_name;
          productObject.featureAdditional = y.additional;
          productObject.feature_id = y._id;
          productObject.product_id = x._id;

          productsArray.push(productObject);
        }
        // console.log(productObject)
      }
      setFeaturesArray(productsArray);
      setProducts(res.data.data);
    };
    fetchProducts();
  }, []);

  const handleSearchSubmit = async (e) => {
    const res = await axiosInstance.post("/product/fetchAll/0/0", {
      token: user.data.token,
    });

    let productsArray = [];
    for (let x of res.data.data) {
      if (x._id == e.target.value) {
        for (let y of x["features"]) {
          var productObject = {};
          productObject.featureName = y.name;
          productObject.productName = x.name;
          productObject.featureThaiName = y.thai_name;
          productObject.featureAdditional = y.additional;
          productObject.feature_id = y._id;
          productObject.product_id = x._id;
          productsArray.push(productObject);
        }
      }
      if (e.target.value == "all") {
        for (let y of x["features"]) {
          var productObject = {};
          productObject.featureName = y.name;
          productObject.productName = x.name;
          productObject.featureThaiName = y.thai_name;
          productObject.featureAdditional = y.additional;
          productObject.feature_id = y._id;
          productObject.product_id = x._id;
          productsArray.push(productObject);
        }
      }
    }

    setFeaturesArray(productsArray);
  };

  const handleClickOpen = (id) => {
    console.log(id)
    setOpen2(true);
    setStyleOptionId(id);
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDelete = async () => {
    const res1 = await axiosInstance.post("/feature/delete/" + styleOptionId, {
      token: user.data.token,
    });
    console.log(styleOptionId)
    console.log(res1.data)
    if (res1) {
      const res1 = await axiosInstance.post("/feature/fetchAll/0/0", {
        token: user.data.token,
      });
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });

      const newArray = res1.data.data.map((feature) => {
        const newSubArray = [];
        res.data.data.map((product) => {
          if (product._id === feature.product_id) {
            feature.product_name = product.name;
            newSubArray.push(feature);
          }
        });
        return newSubArray;
      });
      setFeatures(newArray);
      setOpen2(false);
      setOpen(true);
      setSuccess(true);
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

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="manage-button-head">
            <div className="manage-button-head-inner">
              <strong>Manage Style Options</strong>
            </div>
            <div style={{ display: "inline-block", padding: "15px" }}>
              {/* <Link to="/admin/addGroupStyle" className="b-btn" style={{marginRight:"15px"}}>
                {" "}
               Create Group Style{" "}
              </Link> */}
              <Link to="/admin/addStyleOption" className="b-btn">
                {" "}
                Add New Style Option{" "}
              </Link>
            </div>
          </div>
          <div className="searchstyle">
            <p>Select Product</p>
            <select
              name="product"
              id="product"
              className="searchinput"
              onChange={(e) => handleSearchSubmit(e)}
            >
              <option value="all">All Product</option>
              {products.map((product) => (
                <option value={product._id}>{product.name.charAt(0).toUpperCase() + product.name.slice(1)}</option>
              ))}
            </select>
          </div>
          <table className="table">
            <thead>
              <tr>
                {/* {/ <th>ID</th>  /} */}
                <th>PRODUCT</th>
                <th>OPTION CHOICE NAME</th>
                <th>THAI OPTION CHOICE NAME</th>
                <th>ADDITIONAL</th>
                <th>TYPE</th>
                <th>EDIT STYLING</th>
                <th>OPTION</th>
              </tr>
            </thead>
            <tbody>
              {featuresArray.map((features, key) => {
                console.log(features)
                return (
                  <tr key={key}>
                    <td>{features.productName.charAt(0).toUpperCase() + features.productName.slice(1)}</td>
                    <td>{features.featureName.charAt(0).toUpperCase() + features.featureName.slice(1)}</td>
                    <td>{features.featureThaiName.charAt(0).toUpperCase() + features.featureThaiName.slice(1)}</td>
                    <td>
                      <strong>
                        {features.featureAdditional == true ? "Yes" : "No"}
                      </strong>
                    </td>
                    <td>
                      <strong>Normal</strong>
                    </td>
                    <td>
                      <strong>
                        <Link
                          to={`/admin/editStyling/${features.feature_id}`}
                          className="action"
                        >
                          Edit Styling
                        </Link>
                      </strong>
                    </td>
                    <td>
                      <strong>
                        <Link
                          to={`/admin/addStyleOption/${features.feature_id}`}
                          className="action"
                        >
                          Edit
                        </Link>{" "}
                        |{" "}
                        <button
                          onClick={() => handleClickOpen(features.feature_id)}
                          className="delete"
                        >
                          Delete
                        </button>
                      </strong>
                    </td>
                  </tr>
                );
              })}
              {
                // products.map((product, key) => {
                //   // console.log(product)
                //   product['features'].map((feature, index)=>{
                //     return(
                //       <tr key={index}>
                //         {/ <td>{i++}</td> /}
                //         <td>{product.name}</td>
                //         <td>{feature.name}</td>
                //         <td>{feature.thai_name}</td>
                //         <td>
                //           <strong>
                //             {feature.additional == true ? "Yes" : "No"}
                //           </strong>
                //         </td>
                //         <td>
                //           <strong>Normal</strong>
                //         </td>
                //         <td>
                //           <strong>
                //             <Link
                //               to={`/admin/editStyling/${feature._id}`}
                //               className="action"
                //             >
                //               Edit Styling
                //             </Link>
                //           </strong>
                //         </td>
                //         <td>
                //           <strong>
                //             <Link
                //               to={`/admin/addStyleOption/${feature._id}`}
                //               className="action"
                //             >
                //               Edit
                //             </Link>{" "}
                //             |{" "}
                //             <button
                //               onClick={() => handleClickOpen(feature._id)}
                //               className="delete"
                //             >
                //               Delete
                //             </button>
                //           </strong>
                //         </td>
                //       </tr>
                //     )
                //   })
                //   })
              }
            </tbody>
          </table>
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
            Style Option deleted successfully!
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
