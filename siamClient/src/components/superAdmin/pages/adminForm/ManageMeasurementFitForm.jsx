import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import { ContactSupportOutlined } from "@mui/icons-material";
import { set } from "react-hook-form";
import { useForm } from "react-hook-form";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Tooltip from "@mui/material/Tooltip";
import { Link } from "react-router-dom";
import FadeLoader from "react-spinners/FadeLoader";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageMeasurementFitForm() {
  const { reset, formState } = useForm();
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState("");
  const { user } = useContext(Context);
  const [productId, setProductId] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectRetailer, setSelectRetailer] = useState(true);
  const [measurements, setMeasurements] = useState([]);
  const [jacketList, setJacketList] = useState([]);
  const [customFits, setCustomFits] = useState([]);
  const [measurementHeader, setMeasurementHeader] = useState([]);
  const [values, setValues] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });

      setProducts(res.data.data);
    };
    fetchProducts();
  }, []);

  // console.log(products)
  let object = {};

  const handleProduct = async (e) => {
    setJacketList([object]);
    const product_id = e.target.value;
    setProductId(e.target.value);
    const res1 = await axiosInstance.post("/product/fetch/" + product_id, {
      token: user.data.token,
    });

    setProductName(res1.data.data[0].name);
    const res = await axiosInstance.post(
      "/measurement/fetchMeasurement/" + product_id,
      { token: user.data.token }
    );

    let baseArray = [
      {
        fitting: {
          product_id: product_id,
          fitting_name: "",
          measurements: [],
        },
      },
    ];

    if (res.data.data != undefined) {
      for (let x of res.data.data) {
        const newObject = {};
        newObject.measurement_id = x._id;
        newObject.measurement_name = x.name;
        newObject.fitting_value = 0;
        baseArray[0].fitting.measurements.push(newObject);
      }
      setCustomFits(baseArray);
      setMeasurements(res.data.data);
      setMeasurementHeader(res.data.data);
    } else {
      setMeasurementHeader([]);
      setJacketList([]);
      setMeasurements([]);
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("No measurement found for this product!");
    }
  };

  const handleJacketInputChange = (event, index) => {
    // console.log()
    
    // const regex = /([0-9]*[\.|\,]{0,1}[0-9]{0,2})/s;
    // return value.match(regex)[0];
    const { name, value } = event.target;
    const newInputList = [...jacketList];
    newInputList[index][name] =  value;
    setJacketList(newInputList);

    if (setMeasurements == null) {
      setMeasurements([]);
      for (let x of measurements) {
        object.size = "";
        object[x.name] = "";
      }
    }

    const fittingObject = customFits;

    for (let x of fittingObject) {
      if (event.target.name == "size") {
        x.fitting.fitting_name = event.target.value;
      }
      for (let y of x.fitting.measurements) {
        if (y.measurement_id == event.target.name) {
          y.fitting_value = event.target.value;
        }
      }
    }

    setCustomFits(fittingObject);
  };

  const handleCreateCustomFitting = async (e) => {
    // console.log(customFits[0].fitting)
    // console.log(customFits[0].fitting.measurements[0].fitting_name)
    let filledItems = false;
    for (let q of customFits[0].fitting.measurements) {
      if (q.fitting_value != 0) {
        filledItems = true;
        // console.log(filledItems)
      }
    }
    // console.log(customFits[0].fitting.fitting_name.length);
    if (filledItems == true && customFits[0].fitting.fitting_name.length > 0) {
      const res = await axiosInstance.post("/customFittings/create", {
        fitting: customFits[0].fitting,
        token: user.data.token,
      });

      if (res.data.status == true) {
        setSuccess(true);
        setOpen(true);
        setError(false);
        setErrorMsg("Measurement Created successfully!");
        setMeasurementHeader([]);
        setJacketList([]);
        setMeasurements([]);
        setProductName("");
      } else {
        setSuccess(false);
        setOpen(true);
        setError(true);
        setErrorMsg(res.data.message);
      }
    } else if (filledItems != true) {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("Fill atleast one of the measurements!");
    } else {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill the necessary fields");
    }
  };

  const handleRemoveJacketItem = (index) => {
    const newList = [...jacketList];
    newList.splice(index, 1);
    setJacketList(newList);
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
            <strong> Add Measurement Fits </strong>
            <div>
              <Tooltip title="back">
                <Link
                  to={"/admin/measurementfits"}
                  className="action backButton"
                >
                  <ArrowBackIcon />
                </Link>
              </Tooltip>
            </div>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form>
              <div className="add-measurment-boxNM">
                <div className="form-group row ">
                  <div className="col-md-4">
                    <div className="searchinput-inner">
                      <p>
                        Product <span className="red-required">*</span>
                      </p>
                      <select className="searchinput" onChange={handleProduct}>
                        {productName.length > 0 ? (
                          <option>Select a Product</option>
                        ) : (
                          <option selected>Select a Product</option>
                        )}

                        {products.map((product) => (
                          <option value={product._id}>
                            {product.name.charAt(0).toUpperCase() +
                              product.name.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {measurements.length > 0 ? (
                  <div className="modal-inner-content">
                    <p>Measurement Value -</p>
                    <table>
                      <thead>
                        <tr>
                          <th> Size </th>
                          {measurementHeader.map((measurement) => (
                            <th>{(measurement.name).charAt(0).toUpperCase() + (measurement.name).slice(1)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jacketList.map((data, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                className="measurementfit"
                                name="size"
                                type="text"
                                onChange={(event) =>
                                  handleJacketInputChange(event, index)
                                }
                              />
                            </td>
                            {/* {console.log(measurements)} */}
                            {measurements.map((data) => (
                              <td>
                                <input
                                  className="measurementfit"
                                  name={data._id}
                                  placeholder="00.00"
                                  // step={0.05}
                                  type="number"
                                  // measurement_name={data}
                                  measurement_id={data._id}
                                  
                                  onChange={(event) =>
                                    handleJacketInputChange(event, index)
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="append-inputs-btn mt-15">
                      <button
                        type="button"
                        className="custom-btn"
                        onClick={handleCreateCustomFitting}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <></>
                )}
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
                    Measurement Fit created successfully!
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
