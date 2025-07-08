import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import FadeLoader from "react-spinners/FadeLoader";
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageMeasurementFitProdcutForm() {
  const { reset, formState } = useForm();
  const [products, setProducts] = useState([]);
  const { user } = useContext(Context);
  const [productId, setProductId] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [fittings, setFittings] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [customFittings, setCustomFitting] = useState([]);
  const params = useParams();
  const [product, setProductName] = useState([]);
  const [loading, setLoading] = useState(true);







  useEffect(() => {
    const fetchProductsMeasureMentsFit = async () => {
      const res = await axiosInstance.post(
        `/customFittings/fetch/${params.id}`,
        {
          token: user.data.token,
        }
      );

      console.log(res)

      const res1 = await axiosInstance.post(
        `/measurement/fetchMeasurement/${params.id}`,
        { token: user.data.token }
      );

      const getProduct = await axiosInstance.post(
        `/product/fetch/${params.id}`,
        { token: user.data.token }
      );
      setFittings(res.data.data);
      setMeasurements(res1.data.data);
      setProductName(getProduct.data.data);
      setLoading(false);
    };
    fetchProductsMeasureMentsFit();
  }, []);

  let object = {};

  // ========================abbas and naveen jr========================
  // ========================abbas and naveen jr========================
  // ========================abbas and naveen jr========================
  // ========================abbas and naveen jr========================

  const handleProductChange = async (e) => {
    setProductId(e.target.value);

    const res = await axiosInstance.post(
      "/measurement/fetchMeasurement/" + e.target.value,
      { token: user.data.token }
    );

    const res2 = await axiosInstance.post(
      "/customFittings/fetch/" + e.target.value,
      { token: user.data.token }
    );

    setFittings(res2.data.data);
    for (let x of res.data.data) {
      object.size = "";
      object[x.name] = "";
    }
    setMeasurements(res.data.data);
  };
  // console.log(fittings)
  const handleDeletefitting = async (e) => {
    // console.log(e.target.value)
   
    if (e.target == e.currentTarget) {
      if (window.confirm("You want to delete ?")) {
        setLoading(true);
        const deleteFitting = await axiosInstance.post
        (
          `/customFittings/delete/${e.target.value}`,
          {
            token: user.data.token,
          }
        );

        if (deleteFitting.data.status == true) {
          const res = await axiosInstance.post(
            `/customFittings/fetch/${params.id}`,
            {
              token: user.data.token,
            }
          );
          setFittings(res.data.data);
          setLoading(false);
          setSuccess(true);
          setOpen(true);
          setError(false);
          setSuccessMsg("delete successfully!");
        } else {
          setSuccess(false);
          setOpen(true);
          setError(true);
          setErrorMsg(deleteFitting.data.message);
        }
      }
    } else {
      e.preventDefault();
    }
  };

  // const handleDeletefittingOnIcon = async(event)=>{
  //   console.log(event)
  // }

  // ========================abbas and naveen jr========================
  // ========================abbas and naveen jr========================
  // ========================abbas and naveen jr========================

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
            <strong> Product Measurement Fits </strong>
            <div>
              <Tooltip title="back">
                <Link
                  to={`/admin/measurementfits`}
                  className="action backButton"
                >
                  <ArrowBackIcon />
                </Link>
              </Tooltip>
            </div>
          </div>

          {fittings != null ? (
            <div className="factory-user-from-NM pd-15">
              <form>
                <div className="add-measurment-boxNM">
                  <div className="modal-inner-content">
                    <div>
                      Product:{" "}
                      <span style={{ color: "black", fontWeight: 600 }}>
                        {product[0].name.toUpperCase()}
                      </span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th> Size </th>
                          {measurements.map((measurement) => (
                            <th>{measurement.name.charAt(0).toUpperCase() + measurement.name.slice(1)}</th>
                          ))}
                          <th> Action </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fittings != null ? (
                          fittings.map((fitting) => (
                            <tr>
                              <td>{fitting.fitting_name.charAt(0).toUpperCase() + fitting.fitting_name.slice(1)}</td>
                              {measurements.map((mea, index) => (
                                <td>
                                  {fitting.measurements[index]
                                    ? fitting.measurements[index].fitting_value
                                    : 0}
                                </td>
                              ))}

                              <td colSpan="2">
                                <Tooltip title="Edit">
                                  <Link
                                    to={`/admin/productMeasurementFitEdit/${fitting._id}`}
                                    className="action"
                                  >
                                    <EditIcon />
                                  </Link>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <Button
                                    className="delete-icon"
                                    name={fitting._id}
                                    value={fitting._id}
                                    onClick={handleDeletefitting}
                                  >
                                    <DeleteIcon></DeleteIcon>
                                  </Button>
                                </Tooltip>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <>zczxcxz</>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <>
              <h1 className="top-heading-title">No data found</h1>
            </>
          )}
        </div>
      </div>
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
