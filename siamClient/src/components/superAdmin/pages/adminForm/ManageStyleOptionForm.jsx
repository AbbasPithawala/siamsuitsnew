import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useLocation } from "react-router-dom";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageStyleOptionFrom() {
  const [name, setName] = useState("");
  const [thaiName, setThaiName] = useState("");
  const [products, setProducts] = useState([]);
  const [additional, setAdditional] = useState(false);
  const [product, setProduct] = useState("");
  const [processes, setProcesses] = useState([]);
  const [process, setProcess] = useState("");
  const { user } = useContext(Context);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const id = location.pathname.split("/")[3];
  useEffect(() => {
    fetchProcesses()
    fetchProducts();
    if(id){
      fetchFeature();
    }
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    const newFeature = {
      feature: {
        product_id: product,
        name: name,
        thai_name: thaiName,
        additional: additional,
        process: process,
      },
      token: user.data.token,
    };
    if (name == "" || thaiName == "" || product == "" || process == "") {
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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const newFeature = {
      feature: {
        product_id: product,
        name: name,
        thai_name: thaiName,
        additional: additional,
        process: process,
      },
      token: user.data.token,
    };

    if (name == "" || thaiName == "" || product == "" || process == "") {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      const res = await axiosInstance.put("/feature/update/" + id, newFeature);
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

  const fetchProcesses = async () => {
    const res = await axiosInstance.post("/product/fetchProcess", {
      token: user.data.token,
    });
    setProcesses(res.data.data);
  };

  const fetchProducts = async () => {
    const res = await axiosInstance.post("product/fetchAll/0/0", {
      token: user.data.token,
    });
    setProducts(res.data.data);
  };

  const fetchFeature = async () => {
    const res = await axiosInstance.post("/feature/fetch/" + id, {
      token: user.data.token,
    });
    setName(res.data.data[0].name);
    setThaiName(res.data.data[0].thai_name);
    setAdditional(res.data.data[0].additional);
    setProduct(res.data.data[0].product_id);
    setProcess(res.data.data[0].process);
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
            <strong> {id ? "Edit" : "Add"} Style </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form onSubmit={id ? handleEditSubmit : handleSubmit}>
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
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Process <span className="red-required">*</span>
                    </p>
                    <select
                      className="searchinput"
                      value={process}
                      onChange={(e) => setProcess(e.target.value)}
                    >
                      <option>Select Process</option>
                      {processes.map((proc) => (
                        <option value={proc._id}>
                          {proc.name.charAt(0).toUpperCase() +
                            proc.name.slice(1)}
                        </option>
                      ))}
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
