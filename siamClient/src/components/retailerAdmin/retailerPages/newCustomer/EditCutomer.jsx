import React, { useState, useContext, useEffect } from "react";
// import "./../Step1/Step1.css";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import validator from "validator";
import { axiosInstance } from "../../../../config";
import { Context } from "../../../../context/Context";
import { Link, useParams } from "react-router-dom";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { PicBaseUrl } from "../../../../imageBaseURL";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function EditCustomer() {
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { id } = useParams();
  const [successMsg, setSuccessMsg] = useState("");
  const { user } = useContext(Context);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState({
    firstname: "",
    lastname: "",
    gender: "",
    email: "",
    phone: "",
    image: "",
    imageNote: "",
  });
  const [validationError, setValidationError] = useState({
    firstname: false,
    lastname: false,
    gender: false,
  });

  useEffect(() => {
    const fetchCustomer = async () => {
      const res = await axiosInstance.post(
        `/userMeasurement/fetchCustomerByID/${id}`,
        { token: user.data.token }
      );
      setCustomer(res.data.data[0]);
    };
    fetchCustomer();
  }, []);

  const handleSubmit = async () => {
    if (validator.isEmpty(customer.firstname)) {
      setValidationError({ firstname: customer.firstname.length === 0 });
    } else if (validator.isEmpty(customer.lastname)) {
      setValidationError({ lastname: customer.lastname.length === 0 });
    } else if (validator.isEmpty(customer.gender)) {
      setValidationError({ gender: customer.gender.length === 0 });
    } else {
      if (customer.image.name) {
        const data = new FormData();
        data.append("image", customer.image);
        const res = await axiosInstance.post("image/upload", data);
        // customer.image = `${res.data.data.split("/")[1]}.png`
        customer.image = res.data.data
      }

      const customerData = {
        token: user.data.token,
        customer: customer,
      };

      const res = await axiosInstance.put(
        `userMeasurement/updateCustomer/${id}`,
        customerData
      );

      if (res.data.status == true) {
        setSuccess(true);
        setOpen(true);
        setError(false);
        setSuccessMsg(res.data.message);
      } else {
        setSuccess(false);
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
      <div className="content-wrapper pd-1r">
        <div className="steop-one-wrapper">
          <h3 className="steper-title"> Edit Customer Profile </h3>
          <div className="step-formSteps">
            <div className="fileupload-box_NM">
              <label htmlFor="fileInput">
                {/* {
                customer.image ? 
                <img 
                style={{width: "200px", height: "200px", borderRadius: "50%" }}
                src={URL.createObjectURL(customer.image)} alt="" className='uploaded-image'/>
                :
                <>
                 <AccountCircleIcon className='upload-image' color='primary' 
                  style={{width: "200px", height: "200px", borderRadius: "50%" }}
                 />
                </>
              }  */}
                {customer.image ? (
                  customer.image.name ? (
                    <img
                      style={{
                        width: "200px",
                        height: "200px",
                        borderRadius: "50%",
                      }}
                      src={URL.createObjectURL(customer.image)}
                      alt=""
                      className="uploaded-image"
                    />
                  ) : (
                    <img
                      style={{
                        width: "200px",
                        height: "200px",
                        borderRadius: "50%",
                      }}
                      src={PicBaseUrl + customer.image}
                      alt=""
                      className="uploaded-image"
                    />
                  )
                ) : (
                  <>
                    <AccountCircleIcon
                      className="upload-image"
                      color="primary"
                      style={{
                        width: "200px",
                        height: "200px",
                        borderRadius: "50%",
                      }}
                    />
                  </>
                )}
                <h3>Add Photo</h3>
              </label>
              <input
                type="file"
                name="image"
                id="fileInput"
                className="inputfile-button"
                style={{ display: "none" }}
                onChange={(e) =>
                  setCustomer({ ...customer, image: e.target.files[0] })
                }
              />
            </div>
            <div
              className={
                validationError.firstname
                  ? "form-group error-handle"
                  : "form-group"
              }
            >
              <label>
                {" "}
                First Name <span className="red-required">*</span>
              </label>
              <input
                type="text"
                className="searchinput"
                value={customer.firstname}
                placeholder="James"
                onChange={(e) =>
                  setCustomer({ ...customer, firstname: e.target.value })
                }
                required
              />
            </div>
            <div
              className={
                validationError.lastname
                  ? "form-group error-handle"
                  : "form-group"
              }
            >
              <label>
                {" "}
                Last Name <span className="red-required">*</span>
              </label>
              <input
                type="text"
                value={customer.lastname}
                className="searchinput"
                placeholder="Doe"
                onChange={(e) =>
                  setCustomer({ ...customer, lastname: e.target.value })
                }
                required
              />
            </div>
            <div
              className={
                validationError.gender
                  ? "form-group error-handle"
                  : "form-group"
              }
            >
              <label>
                {" "}
                Gender <span className="red-required">*</span>
              </label>
              <select
                className="searchinput"
                value={customer.gender}
                onChange={(e) =>
                  setCustomer({ ...customer, gender: e.target.value })
                }
                required
              >
                <option value="Select Gender"> Select Gender </option>
                <option value="Male"> Male </option>
                <option value="Female"> Female </option>
                <option value="Other"> Other </option>
              </select>
            </div>
            <div className="form-group">
              <label> Email </label>
              <input
                type="email"
                className="searchinput"
                value={customer.email}
                placeholder="james@example.com"
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label> Contact </label>
              <input
                type="text"
                className="searchinput"
                value={customer.phone}
                placeholder="12345"
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
              />
            </div>
            <div className="image-note">
              <label> Customer Image Note</label>
              <textarea
                className="searchinput"
                value={customer.imageNote}
                onChange={(e) =>
                  setCustomer({ ...customer, imageNote: e.target.value })
                }
              ></textarea>
            </div>
          </div>
          <div className="col savesumitbtnnm">
            <input
              type="submit"
              onClick={handleSubmit}
              className="custom-btn"
              value="Update"
            />
            <Link to={`/retailer/viewCustomers`} className="outline-back-btn">
              Back
            </Link>
          </div>
        </div>
      </div>
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
