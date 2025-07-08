import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useParams, useNavigate } from "react-router-dom";
import "./../admin/admin.css";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FadeLoader from "react-spinners/FadeLoader";
import Tooltip from "@mui/material/Tooltip";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

let Ms = [];

export default function ManageMeasurementFitEditForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { user } = useContext(Context);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [product, setProductName] = useState([]);
  const [customFits, setCustomFits] = useState([]);
  const [fittingValueArray, setFittingValueArray] = useState([]);
  const params = useParams();

  useEffect(() => {
    const fetchMeasurementsFit = async () => {
      const res = await axiosInstance.post(
        `/customFittings/fetchFitting/${params.id}`,
        {
          token: user.data.token,
        }
      );
      const res1 = await axiosInstance.post(
        `/measurement/fetchMeasurement/${res.data.data[0].product_id}`,
        { token: user.data.token }
      );

      const getProduct = await axiosInstance.post(
        `/product/fetch/${res.data.data[0].product_id}`,
        { token: user.data.token }
      );

      setCustomFits(res.data.data);
      setMeasurements(res1.data.data);
      setProductName(getProduct.data.data);



      setLoading(false);

      res.data.data.map((data) => {
        const tempArray = [];
        data.measurements.map((measurement) => {
          tempArray.push(measurement.fitting_value);
        });
        setFittingValueArray(tempArray);
      });
    };
    fetchMeasurementsFit();
  }, []);

  // customFits.map((data) => { 
  //   // console.log(data.measurements)
  //   setM(data.measurements);
  // });


  const handlePlaceHolder = async (e) => {
    e.target.value = "";
    console.log(e.target.value);
  };

  const handleJacketInputChange = (event, index) => {
    if (event.target.value == "") {
      fittingValueArray[index] = 0;
      setFittingValueArray([...fittingValueArray])
    } else {
      fittingValueArray[index] = Number(event.target.value);
      setFittingValueArray([...fittingValueArray])
    }

    const fittingObject = customFits;
    for (let x of fittingObject) {
      if (event.target.name == "size") {
        // console.log(x)
        x.fitting_name = event.target.value;
      }
      for (let y of x.measurements) {
        if (y.measurement_id == event.target.name) {
          if (event.target.value == "") {
            y.fitting_value = 0;
          } else {
            y.fitting_value = parseFloat(event.target.value);
          }
        }
      }
    }
    setCustomFits(fittingObject);
  };



  const handleUpdateCustomFitting = async (e) => {
    const res = await axiosInstance.put(
      `/customFittings/updateMeasurementFits/${params.id}`,
      {
        fitting: customFits,
        token: user.data.token,
      }
    );

    if (res.data.status == true) {
      setSuccess(true);
      setOpen(true);
      setError(false);
      setErrorMsg("update successfully!");
      setTimeout(() => {
        navigate(`/admin/productMeasurementFit/${customFits[0].product_id}`);
      }, 1000);
    } else {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg(res.data.message);
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

  return loading ? (
    <>
        <div className="spinnerStyle">
        <FadeLoader color="#1d81d2"/>
        </div>
    </>
  ) : (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Edit Measurement Fits </strong>
            <div>
              <Tooltip title="back">
                <Link
                  to={`/admin/productMeasurementFit/${customFits[0].product_id}`}
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
                <div className="form-group row "></div>
                {measurements.length > 0 ? (
                  <div className="modal-inner-content">
                    <div>
                      Product name -{" "}
                      <span style={{ color: "black", fontWeight: 600 }}>
                        {product[0].name}
                      </span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th> Size </th>
                          {measurements.map((measurement) => (
                            <th>{(measurement.name).charAt(0).toUpperCase() + (measurement.name).slice(1)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {customFits.map((data, index) => (
                          <tr >
                            <td key={index}>
                              <input
                                className="measurementfit"
                                name="size"
                                type="text"
                                value={data.fitting_name}
                                onClick={handlePlaceHolder}
                                onChange={(event) =>
                                  handleJacketInputChange(event)
                                }
                              />
                            </td>
                            {/* {m.map((data1, i) => {
                              <td>
                              <div
                                key={data1._id}
                              >
                                <input
                                  name="fitting_value"
                                  type="text"
                                  value={data1.fitting_value}
                                  onChange={(e) => handleJacketInputChange(e, i)}
                                />
                              </div>;
                              </td>

                            })} */}
                            {data.measurements.map((measurment, index) => (
                              <td>
                                <input
                                  id="inputID"
                                  className="measurementfit"
                                  name={measurment.measurement_id}
                                  type="number"
                                  value={fittingValueArray[index]}
                                  onClick={handlePlaceHolder}
                                  placeholder="00.00"
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
                        onClick={handleUpdateCustomFitting}
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



// import React, { useState, useContext, useEffect } from "react";
// import { Context } from "../../../../context/Context";
// import { axiosInstance } from "./../../../../config";
// import IconButton from "@mui/material/IconButton";
// import CloseIcon from "@mui/icons-material/Close";
// import Snackbar from "@mui/material/Snackbar";
// import MuiAlert from "@mui/material/Alert";
// import Button from "@mui/material/Button";
// import { useParams, useNavigate } from "react-router-dom";
// import "./../admin/admin.css";
// import { Link } from "react-router-dom";
// import ArrowBackIcon from "@mui/icons-material/ArrowBack";
// import FadeLoader from "react-spinners/FadeLoader";
// import Tooltip from "@mui/material/Tooltip";

// const Alert = React.forwardRef(function Alert(props, ref) {
//   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// });

// let Ms = [];

// export default function ManageMeasurementFitEditForm() {
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(true);
//   const { user } = useContext(Context);
//   const [success, setSuccess] = useState(false);
//   const [errorMsg, setErrorMsg] = useState("");
//   const [error, setError] = useState(false);
//   const [open, setOpen] = useState(false);
//   const [measurements, setMeasurements] = useState([]);
//   const [product, setProductName] = useState([]);
//   const [customFits, setCustomFits] = useState([]);
//   const [fittingValueArray, setFittingValueArray] = useState([]);
//   const params = useParams();

//   useEffect(() => {
//     const fetchMeasurementsFit = async () => {
//       const res = await axiosInstance.post(
//         `/customFittings/fetchFitting/${params.id}`,
//         {
//           token: user.data.token,
//         }
//       );
//       const res1 = await axiosInstance.post(
//         `/measurement/fetchMeasurement/${res.data.data[0].product_id}`,
//         { token: user.data.token }
//       );

//       const getProduct = await axiosInstance.post(
//         `/product/fetch/${res.data.data[0].product_id}`,
//         { token: user.data.token }
//       );

//       setCustomFits(res.data.data);
//       setMeasurements(res1.data.data);
//       setProductName(getProduct.data.data);



//       setLoading(false);

//       res.data.data.map((data) => {
//         const tempArray = [];
//         data.measurements.map((measurement) => {
//           tempArray.push(measurement.fitting_value);
//         });
//         setFittingValueArray(tempArray);
//       });
//     };
//     fetchMeasurementsFit();
//   }, []);

//   // customFits.map((data) => { 
//   //   // console.log(data.measurements)
//   //   setM(data.measurements);
//   // });


//   const handlePlaceHolder = async (e) => {
//     e.target.placeholder = "";
//     console.log(e.target.placeholder);
//   };

//   const handleJacketInputChange = (event, index) => {
//     if (event.target.value == "") {
//       fittingValueArray[index] = 0;
//       setFittingValueArray([...fittingValueArray])
//     } else {
//       fittingValueArray[index] = Number(event.target.value);
//       setFittingValueArray([...fittingValueArray])
//     }

//     const fittingObject = customFits;
//     for (let x of fittingObject) {
//       if (event.target.name == "size") {
//         // console.log(x)
//         x.fitting_name = event.target.value;
//       }
//       for (let y of x.measurements) {
//         if (y.measurement_id == event.target.name) {
//           if (event.target.value == "") {
//             y.fitting_value = 0;
//           } else {
//             y.fitting_value = Number(event.target.value);
//           }
//         }
//       }
//     }
//     setCustomFits(fittingObject);
//   };

//   const handleUpdateCustomFitting = async (e) => {
//     const res = await axiosInstance.put(
//       `/customFittings/updateMeasurementFits/${params.id}`,
//       {
//         fitting: customFits,
//         token: user.data.token,
//       }
//     );

//     if (res.data.status == true) {
//       setSuccess(true);
//       setOpen(true);
//       setError(false);
//       setErrorMsg("update successfully!");
//       setTimeout(() => {
//         navigate(`/admin/productMeasurementFit/${customFits[0].product_id}`);
//       }, 1000);
//     } else {
//       setSuccess(false);
//       setOpen(true);
//       setError(true);
//       setErrorMsg(res.data.message);
//     }
//   };

//   const handleClose = (event, reason) => {
//     if (reason === "clickaway") {
//       return;
//     }

//     setSuccess(false);
//     setOpen(false);
//     setError(false);
//   };

//   const action = (
//     <React.Fragment>
//       <Button color="secondary" size="small" onClick={handleClose}>
//         UNDO
//       </Button>
//       <IconButton
//         size="small"
//         aria-label="close"
//         color="inherit"
//         onClick={handleClose}
//       >
//         <CloseIcon fontSize="small" />
//       </IconButton>
//     </React.Fragment>
//   );

//   return loading ? (
//     <>
//         <div className="spinnerStyle">
//         <FadeLoader color="#1d81d2"/>
//         </div>
//     </>
//   ) : (
//     <main className="main-panel">
//       <div className="content-wrapper">
//         <div className="order-table manage-page">
//           <div className="top-heading-title">
//             <strong> Edit Measurement Fits </strong>
//             <div>
//               <Tooltip title="back">
//                 <Link
//                   to={`/admin/productMeasurementFit/${customFits[0].product_id}`}
//                   className="action backButton"
//                 >
//                   <ArrowBackIcon />
//                 </Link>
//               </Tooltip>
//             </div>
//           </div>
//           <div className="factory-user-from-NM pd-15">
//             <form>
//               <div className="add-measurment-boxNM">
//                 <div className="form-group row "></div>
//                 {measurements.length > 0 ? (
//                   <div className="modal-inner-content">
//                     <div>
//                       Product name -{" "}
//                       <span style={{ color: "black", fontWeight: 600 }}>
//                         {product[0].name}
//                       </span>
//                     </div>
//                     <table>
//                       <thead>
//                         <tr>
//                           <th> Size </th>
//                           {measurements.map((measurement) => (
//                             <th>{measurement.name}</th>
//                           ))}
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {customFits.map((data, index) => (
//                           <tr >
//                             <td key={index}>
//                               <input
//                                 className="measurementfit"
//                                 name="size"
//                                 type="text"
//                                 value={data.fitting_name}
//                                 onClick={handlePlaceHolder}
//                                 onChange={(event) =>
//                                   handleJacketInputChange(event)
//                                 }
//                               />
//                             </td>
//                             {/* {m.map((data1, i) => {
//                               <td>
//                               <div
//                                 key={data1._id}
//                               >
//                                 <input
//                                   name="fitting_value"
//                                   type="text"
//                                   value={data1.fitting_value}
//                                   onChange={(e) => handleJacketInputChange(e, i)}
//                                 />
//                               </div>;
//                               </td>

//                             })} */}
//                             {data.measurements.map((measurment, index) => (
//                               <td>
//                                 <input
//                                   id="inputID"
//                                   className="measurementfit"
//                                   name={measurment.measurement_id}
//                                   type="text"
//                                   value={fittingValueArray[index]}
//                                   onClick={handlePlaceHolder}
//                                    onChange={(event) =>
//                                     handleJacketInputChange(event, index)
//                                   }
//                                 />
//                               </td>
//                             ))}
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                     <div className="append-inputs-btn mt-15">
//                       <button
//                         type="button"
//                         className="custom-btn"
//                         onClick={handleUpdateCustomFitting}
//                       >
//                         Save
//                       </button>
//                     </div>
//                   </div>
//                 ) : (
//                   <></>
//                 )}
//               </div>
//               {success && (
//                 <Snackbar
//                   open={open}
//                   autoHideDuration={2000}
//                   onClose={handleClose}
//                 >
//                   <Alert
//                     onClose={handleClose}
//                     severity="success"
//                     sx={{ width: "100%" }}
//                   >
//                     Measurement Fit created successfully!
//                   </Alert>
//                 </Snackbar>
//               )}
//               {error && (
//                 <Snackbar
//                   open={open}
//                   autoHideDuration={2000}
//                   onClose={handleClose}
//                   action={action}
//                 >
//                   <Alert
//                     onClose={handleClose}
//                     severity="error"
//                     sx={{ width: "100%" }}
//                   >
//                     {errorMsg}
//                   </Alert>
//                 </Snackbar>
//               )}
//             </form>
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }
