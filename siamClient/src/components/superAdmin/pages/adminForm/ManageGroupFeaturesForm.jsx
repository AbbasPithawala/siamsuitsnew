import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageGroupFeaturesForm() {
  const [name, setName] = useState("");
  const [thaiName, setThaiName] = useState("");
  const [products, setProducts] = useState([]);
  const [features, setFeatures] = useState([]);
  const [additional, setAdditional] = useState(false);
  const [product, setProduct] = useState("");
  const { user } = useContext(Context);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [featureId, setFeatureId] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
    };
    fetchProducts();
  }, []);

  const handleProduct = async (e) => {
    console.log(e.target.value);
    if (e.target.value !== "") {
      setProduct(e.target.value);
      const res = await axiosInstance.post("/product/fetch/" + e.target.value, {
        token: user.data.token,
      });

      setFeatures(res.data.data[0].features);
    } else {
      setProduct("");
      setFeatures([]);
    }
  };
  
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false)
    setOpen(false)
    setError(false)
  };

  const handleCheckboxChange = async (e) => {
    // console.log(e.target.value)
    if(e.target.checked){
        setFeatureId([...featureId, e.target.value])
    }else{
      const updatedSelectedItem = featureId.filter(
        (selectedItem) => selectedItem !== e.target.value
      );
      setFeatureId(updatedSelectedItem);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    let fea = {
      feature : {
        name: name,
        product_id: product,
        thai_name: thaiName,
        feature_id: featureId,
        additional: additional
      },
      token:user.data.token
    }
    if(name =="" || thaiName==""){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill all this input!")
    }else{
      const res = await axiosInstance.post("/groupFeatures/create", fea)
      if(res.data.status==true){
        setOpen(true)
        setSuccess(true)
        setName("")
        setProduct("")
        setThaiName("")
        setFeatures([]);
        setFeatureId([]);
      }else{
        setOpen(true)
        setError(true)
        setErrorMsg(res.data.message)
      }
    }
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


  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Add Group Styles </strong>
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
                      onChange={(e) => handleProduct(e)}
                    >
                      <option value="">Select Product</option>
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
                {features.length > 0 ? (
                  <div className="role_block">
                    <ul>
                      {features.map((data, i) => (
                        <li key={i} style={{listStyleType:"none"}}>
                          <label className="full_label">
                            <input
                              type="checkbox"
                              id={`chk${data.name}`}
                              value={data._id}
                              onChange={handleCheckboxChange}
                            />
                            <label htmlFor={`chk${data.name}`}>
                              {data.name}
                            </label>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <> </>
                )}
                <div className="role_block">{/* <h4>Style Name</h4> */}</div>
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
                    created successfully!
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
