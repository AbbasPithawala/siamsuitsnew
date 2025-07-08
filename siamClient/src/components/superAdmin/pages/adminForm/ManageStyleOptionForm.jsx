import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageStyleOptionFrom() {
  const [name, setName] = useState("");
  const [thaiName, setThaiName] = useState("");
  const [products, setProducts] = useState([]);
  const [additional, setAdditional] = useState(false);
  const [product, setProduct] = useState("");
  const { user } = useContext(Context);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
    };
    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newFeature = {
      feature: {
        product_id: product,
        name: name,
        thai_name: thaiName,
        additional: additional,
      },
      token: user.data.token,
    };
    if (name == "" || thaiName == "" || product == "") {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      const res = await axiosInstance.post("/feature/create", newFeature);
      if (res.data.status == true) {
        setOpen(true);
        setSuccess(true);
        setName("");
        setThaiName("");
        setProduct("");
        setAdditional(false);
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
            <strong> Add Style </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Product <span className="red-required">*</span>
                    </p>
                    <select
                      className="searchinput"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    >
                      <option>Select Product</option>
                      {products.map((product) => (
                        <option value={product._id}>
                          {product.name.charAt(0).toUpperCase() +
                            product.name.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Optional Choice Name{" "}
                      <span className="red-required">*</span>
                    </p>
                    <input
                      className="searchinput"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Thai Optional Choice Name{" "}
                      <span className="red-required">*</span>
                    </p>
                    <input
                      className="searchinput"
                      type="text"
                      value={thaiName}
                      onChange={(e) => setThaiName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <p>Additional</p>
                    <select
                      className="searchinput"
                      value={additional}
                      onChange={(e) => setAdditional(e.target.value)}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div className="col savesumitbtnnm">
                  <input type="submit" className="custom-btn" value="SAVE" />
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
                    Feature created successfully!
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
