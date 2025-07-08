import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import { useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageUpload from "../../../../images/ImageUpload.png";
import AddCircleIcon from '@mui/icons-material/AddCircle';
import StyleOption from "./ManageStylingOptions";
import Dialog from '@mui/material/Dialog';
import { PicBaseUrl } from "../../../../imageBaseURL";
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageEditStyling() {
  const { user } = useContext(Context);
  const location = useLocation();
  const featureId = location.pathname.split("/")[3];
  const [fetchInputList, setfetchInputList] = useState([]);
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState(null);
  const [styleName, setStyleName] = useState("");
  const [productName, setProductName] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [valChange, setValChange] = useState("");
  const [optionValChange, setOptionValChange] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [open3, setOpen3] = useState(false);
  const [styleId, setStyleId] = useState("");
  const [style, setStyle] =useState({});

  const [inputList, setInputList] = useState([
    {
      // step: "",
      name: "",
      thai_name: "",
      image: "",
      price: "",
      worker_price: "",
    },
  ]);

  const [optionList, setOptionList] = useState([
    {
      name: "",
      image: "",
    },
  ]);
  const [fetchOptionList, setfetchOptionList] = useState([]);

  useEffect(() => {
    const fetchStyles = async () => {
      const res = await axiosInstance.post("style/fetchstyle/" + featureId, {
        token: user.data.token,
      });
      setfetchInputList(res.data.data);
    };
    fetchStyles();
  }, []);

  useEffect(() => {
    const fetchFeature = async () => {
      const res = await axiosInstance.post("feature/fetch/" + featureId, {
        token: user.data.token,
      });
      setStyleName(res.data.data[0].name);
      const res1 = await axiosInstance.post(
        "product/fetch/" + res.data.data[0].product_id,
        { token: user.data.token }
      );
      setProductName(res1.data.data[0].name);
    };
    fetchFeature();
  }, []);

  const handleChangeValue = (id) => {
    setValChange(id);
  };

  const handleListAdd = () => {
    setFile(null);
    setInputList([
      ...inputList,
      {
        // step: "",
        name: "",
        thai_name: "",
        image: "",
        price: "",
        worker_price: "",
      },
    ]);
  };

  const handleInputChange = async (event, index) => {
    const { name, value } = event.target;
    const newInputList = [...inputList];
    newInputList[index][name] = value;
    setInputList(newInputList);
  };

  const handleInputChange34 = async (event, index) => {
    const newInputList = [...inputList];
    newInputList[index]["image"] = event.target.files[0];
    setInputList(newInputList);
  };

  const handleInputUpdateChange = (event, index) => {
    const { name, value } = event.target;
    const newInputList = [...fetchInputList];
    newInputList[index][name] = value;
    setfetchInputList(newInputList);
  };

  const handleInputUpdateChange34 = (event, index, id) => {
    setValChange(id);
    const newInputList = [...fetchInputList];
    newInputList[index]["image"] = event.target.files[0];
    setfetchInputList(newInputList);
  };

  const handleRemoveItem = (index) => {
    const newList = [...inputList];
    newList.splice(index, 1);
    setInputList(newList);
  };

  const handleListUpdate = async (id, index) => {
    if (fetchInputList[index].image.name) {
      const data = new FormData();
      data.append("image", fetchInputList[index].image);
      const result = await axiosInstance.post("image/upload", data);
      fetchInputList[index].image = result.data.data
    }

    const updateStyle = {
      style: {
        name: fetchInputList[index].name,
        thai_name: fetchInputList[index].thai_name,
        image: fetchInputList[index].image,
        price: fetchInputList[index].price,
        worker_price: fetchInputList[index].worker_price,
      },
      token: user.data.token,
    };

    if (inputList == "") {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      const res = await axiosInstance.put("/style/update/" + id, updateStyle);
      if (res.data.status == true) {
        setOpen(true);
        setSuccess(true);
        setSuccessMsg(res.data.message);
      } else {
        setOpen(true);
        setError(true);
        setErrorMsg(res.data.message);
      }
    }
  };

  const handleDeleteItem = async (id, index) => {
    const newfetchList = [...fetchInputList];

    const res = await axiosInstance.post("style/delete/" + id, {
      token: user.data.token,
    });
    if (res.data.status == true) {
      newfetchList.splice(index, 1);
      setfetchInputList(newfetchList);
      setOpen(true);
      setSuccess(true);
      setSuccessMsg(res.data.message);
    } else {
      setOpen(true);
      setError(true);
      setErrorMsg(res.data.message);
    }
  };

  const handleSubmit = async () => {
    let stylesArray = [];
    for (let inputs of inputList) {
      if (inputs.image) {
        const data = new FormData();
        data.append("image", inputs.image);
        const result = await axiosInstance.post("image/upload", data);
        inputs.image = result.data.data
      }

      let stylesObject = {
        name: inputs.name,
        thai_name: inputs.thai_name,
        image: inputs.image,
        price: inputs.price,
        worker_price: inputs.worker_price,
        feature_id: featureId,
      };
      stylesArray.push(stylesObject);
    }

    const newStyle = {
      style: stylesArray,
      token: user.data.token,
    };

    if (inputList == "") {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      const res = await axiosInstance.post("/style/create", newStyle);
      if (res.data.status == true) {
        setOpen(true);
        setSuccess(true);
        setSuccessMsg(res.data.message);
        setInputList([]);
        setFile(null);
        const res1 = await axiosInstance.post("style/fetchstyle/" + featureId, {
          token: user.data.token,
        });
        setfetchInputList(res1.data.data);
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
    // ===================New functions=====================
    // ===================New functions=====================

    const handleOpen3 = async (id) => {
      setOpen3(true);
      setStyleId(id);
    };
  
    const handleClose3 = () => {
      setOpen3(false);
    };
    // ========================================================
    // ========================================================
  // ===================static function ======================
  // ===================static function ======================

    const fetchStyle = async(id) => {

      const res = await axiosInstance.post("/style/fetch/" + id, {token : user.data.token})
      return res.data.data[0]
    }


  // ===================static function ends ======================
  // ===================static function ends ======================




  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Edit Styling </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <div className="modal-box-NM">
              <div className="d-flex form-group">
                <div className="data-Table-title">
                  <label>Product : {productName}</label>
                </div>
                <div className="data-Table-title">
                  <label>Style : {styleName}</label>
                </div>
              </div>
              <div className="modal-inner-content">
                <table>
                  <thead>
                    <tr>
                      <th> Option Value </th>
                      <th> Thai Option Value </th>
                      <th> Image </th>
                      <th> Price </th>
                      <th> Worker Price </th>
                      <th> More </th>
                      <th> Action </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fetchInputList !== null ? (
                      fetchInputList.map((data, index) => {
                        return(
                        
                        <tr key={index}>
                          <td>
                            <input
                              className="option-value-input"
                              name="name"
                              value={data.name}
                              onKeyUp={() => handleChangeValue(data._id)}
                              type="text"
                              onChange={(event) =>
                                handleInputUpdateChange(event, index)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="thai-option-value-input"
                              name="thai_name"
                              value={data.thai_name}
                              onKeyUp={() => handleChangeValue(data._id)}
                              type="text"
                              onChange={(event) =>
                                handleInputUpdateChange(event, index)
                              }
                            />
                          </td>
                          <td>
                            <label htmlFor={`inputfile-${data._id}`}>
                              {
                                <img
                                  src={
                                    data.image.length > 0
                                      ? PicBaseUrl + data.image
                                      : ImageUpload
                                  }
                                  width={50}
                                  height={50}
                                />
                              }
                            </label>
                            <input
                              type="file"
                              name="image"
                              className="inputfile-button"
                              id={`inputfile-${data._id}`}
                              style={{ display: "none" }}
                              onChange={(event) =>
                                handleInputUpdateChange34(
                                  event,
                                  index,
                                  data._id
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="price-input"
                              name="price"
                              value={data.price}
                              onKeyUp={() => handleChangeValue(data._id)}
                              type="text"
                              onChange={(event) =>
                                handleInputUpdateChange(event, index)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="worker-price-input"
                              name="worker_price"
                              value={data.worker_price}
                              onKeyUp={() => handleChangeValue(data._id)}
                              type="text"
                              onChange={(event) =>
                                handleInputUpdateChange(event, index)
                              }
                            />
                          </td>
                          <td>
                            <Button
                              className="delete-icon"
                              onClick={() => handleOpen3(data._id, index)}
                            >
                              <AddCircleIcon />
                            </Button>
                          </td>
                          <td>
                            <Button
                              className="delete-icon"
                              onClick={() => handleDeleteItem(data._id, index)}
                            >
                              <DeleteIcon />
                            </Button>
                          </td>
                          <td>
                            {valChange === data._id && (
                              <button
                                type="submit"
                                className="custom-btn"
                                onClick={() =>
                                  handleListUpdate(data._id, index)
                                }
                              >
                                Update
                              </button>
                            )}
                          </td>
                        </tr>
                      )})
                    ) : (
                      <></>
                    )}
                    {inputList.length > 0 &&
                      inputList.map((data, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              className="option-value-input"
                              name="name"
                              value={data.name}
                              type="text"
                              onChange={(event) =>
                                handleInputChange(event, index)
                              }
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="thai-option-value-input"
                              name="thai_name"
                              value={data.thai_name}
                              type="text"
                              onChange={(event) =>
                                handleInputChange(event, index)
                              }
                              required
                            />
                          </td>
                          <td>
                            <label htmlFor={`inputfile-${index}`}>
                              <img
                                src={
                                  data.image
                                    ? URL.createObjectURL(data.image)
                                    : ImageUpload
                                }
                                width={50}
                                height={50}
                              />
                            </label>
                            <input
                              type="file"
                              name="image"
                              id={`inputfile-${index}`}
                              style={{ display: "none" }}
                              onChange={(event) =>
                                handleInputChange34(event, index)
                              }
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="price-input"
                              name="price"
                              value={data.price}
                              type="text"
                              onChange={(event) =>
                                handleInputChange(event, index)
                              }
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="worker-price-input"
                              name="worker_price"
                              value={data.worker_price}
                              type="text"
                              onChange={(event) =>
                                handleInputChange(event, index)
                              }
                              required
                            />
                          </td>
                          <td>
                            <Button
                              className="delete-icon"
                              onClick={() => handleOpen3(index)}
                              style={{display:'none'}}
                            >
                              <AddCircleIcon />
                            </Button>
                          </td>
                          <td colSpan="2">
                            <Button
                              className="delete-icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <DeleteIcon />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="append-inputs-btn mt-15">
                  <input
                    type="submit"
                    className="custom-btn"
                    onClick={handleSubmit}
                    value="Save"
                  />
                  <button
                    type="button"
                    className="custom-btn ms-auto"
                    onClick={handleListAdd}
                  >
                    <i className="fa-solid fa-plus"></i> Add Styling option
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
     
      <Dialog
        open={open3}
        onClose={handleClose3}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        
      >
        <StyleOption
        styleId = {styleId}
        />
      </Dialog>

      {success && (
        <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
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




// const handleRemoveOptionItem = (index) => {
//   const newList = [...optionList];
//   newList.splice(index, 1);
//   setOptionList(newList);
// };

// const handleInputOptionUpdateChange = (event, index) => {
//   const { name, value } = event.target;
//   const newOptionList = [...fetchOptionList];
//   newOptionList[index][name] = value;
//   setfetchOptionList(newOptionList);
// };

// const handleInputOptionUpdateChange34 = (event, index, id) => {
//   setOptionValChange(id);
//   const newOptionList = [...fetchOptionList];
//   newOptionList[index]["image"] = event.target.files[0];
//   setfetchOptionList(newOptionList);
// };

// const handleOptionChangeValue = (id) => {
//   setOptionValChange(id);
// };

// const handleInputOptionChange = async (event, index) => {
//   const { name, value } = event.target;
//   const newOptionList = [...optionList];
//   newOptionList[index][name] = value;
//   setOptionList(newOptionList);
// };

// const handleInputOptionChange34 = async (event, index) => {
//   const newOptionList = [...optionList];
//   newOptionList[index]["image"] = event.target.files[0];
//   setOptionList(newOptionList);
// };

// const handleDeleteOptionItem = async (id, index) => {
//   const newfetchList = [...fetchOptionList];

//   const res = await axiosInstance.post("style/delete/" + id, {
//     token: user.data.token,
//   });
//   if (res.data.status == true) {
//     newfetchList.splice(index, 1);
//     setfetchOptionList(newfetchList);
//     setOpen(true);
//     setSuccess(true);
//     setSuccessMsg(res.data.message);
//   } else {
//     setOpen(true);
//     setError(true);
//     setErrorMsg(res.data.message);
//   }
// };

// const handleOptionSubmit = async () => {

//   let stylesArray = [];
//   for (let inputs of optionList) {
//     if (inputs.image) {
//       const data = new FormData();
//       data.append("image", inputs.image);
//       const result = await axiosInstance.post("image/upload", data);
//       inputs.image = `${result.data.data.split("/")[1]}.png`;
//     }
//     console.log(inputs)
//     let stylesObject = {
//       name: inputs.name,
//       image: inputs.image,
//     };
//     stylesArray.push(stylesObject);
//   }

//   const newStyle = {
//     style_options: stylesArray,
//     token: user.data.token,
//   };
//   console.log(newStyle)

//   if (optionList == "") {
//     setOpen(true);
//     setError(true);
//     setErrorMsg("Please fill this input!");
//   } else {
//     const res = await axiosInstance.put("/style/updateOptions/" + styleId, newStyle);
//     console.log(res)
//     if (res.data.status == true) {
//       setOpen(true);
//       setSuccess(true);
//       setSuccessMsg(res.data.message);
//       setOptionList([]);
//       setFile(null);
//       // const res1 = await axiosInstance.post("style/fetchstyle/" + featureId, {
//       //   token: user.data.token,
//       // });
//       // setfetchOptionList(res1.data.data);
//     } else {
//       setOpen(true);
//       setError(true);
//       setErrorMsg(res.data.message);
//     }
//   }
// };

// const handleOptionListUpdate = async (id, index) => {
//   if (fetchOptionList[index].image.name) {
//     const data = new FormData();
//     data.append("image", fetchOptionList[index].image);
//     const result = await axiosInstance.post("image/upload", data);
//     fetchOptionList[index].image = `${result.data.data.split("/")[1]}.png`;
//   }

//   const updateStyle = {
//     style: {
//       name: fetchOptionList[index].name,
//       image: fetchOptionList[index].image,
//     },
//     token: user.data.token,
//   };

//   if (optionList == "") {
//     setOpen(true);
//     setError(true);
//     setErrorMsg("Please fill this input!");
//   } else {
//     const res = await axiosInstance.put("/style/update/" + id, updateStyle);
//     if (res.data.status == true) {
//       setOpen(true);
//       setSuccess(true);
//       setSuccessMsg(res.data.message);
//     } else {
//       setOpen(true);
//       setError(true);
//       setErrorMsg(res.data.message);
//     }
//   }
// };