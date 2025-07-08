import React, { useState, useContext, useEffect } from "react";
import { Button } from "@material-ui/core";
import { axiosInstance } from "./../../../../../config";
import './NewCustomer.css';
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
// import { useNavigate } from "react-router-dom";
import validator from "validator";
import { Context } from "./../../../../../context/Context";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CustomerProductMeasurements from "./CustomerProductMeasurements";
import { PicBaseUrl } from "../../../../../imageBaseURL";
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
// import { PicBaseUrl } from "./../../../../imageBaseURL";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const missingMeasurementStyles = {
  color: "red",
  cursor: "pointer",
  fontWeight: 600
}

const completeMeasurementStyles = {
  color: "green",
  cursor: "pointer",
  fontWeight: 600
}


const NewCustomer = (
  {
    setOpenCustomerForm,
    productsMeasurementArray,
    suitProductsMeasurementArray,
    tuxedoProductsMeasurementArray,
    orders,
    customerID, setCustomerID,
    customerArray, setCustomerArray,
    handleSaveGroupOrder,
    measurementsFinished,
    setMeasurementsFinished
  }
) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [imageData, setImageData] = useState(null);
  const [validationError, setValidationError] = useState({
    firstname: false,
    lastname: false,
    gender: false
  })
  const { user } = useContext(Context);
  const [customer, setCustomer] = useState({
    firstname: "",
    lastname: "",
    gender: "",
    email: "",
    phone: "",
    retailer_code: user.data.retailer_code,
    image: "",
    imageNote: ""
  });

  // const navigate = useNavigate()




  //================new states (abbas)==============================
  //================================================================

  const [suitcustomerMeasurements, setSuitCustomerMeasurements] = useState({});
  const [tuxedocustomerMeasurements, setTuxedoCustomerMeasurements] = useState({});
  const [customerMeasurements, setCustomerMeasurements] = useState({});
  // const [allCustomers, setAllCustomers] = useState([])
  const [filledMeasurements, setFilledMeasurements] = useState([]);
  const [openMeasurementForm, setOpenMeasurementForm] = useState(false)
  const [product_name, setProduct_name] = useState("");
  const [existingCustomer, setExistingCustomer] = useState(false)
  const [suitFilledMeasurements, setSuitFilledMeasurement] = useState([]);
  const [tuxedoFilledMeasurements, setTuxedoFilledMeasurement] = useState([]);
  const [draftMeasurementsObject, setDraftMeasurementsObject] = useState({})
  const [customerList, setCustomerList] = useState([])

  //================================================================ 
  //================================================================ 


  //================================================================
  //================================================================
  useEffect(() => {
    if (customerID && customerID.length > 0) {
      setExistingCustomer(true)

      const fetchUserMeasurements = async () => {
        const res = await axiosInstance.post(
          "/userMeasurement/fetchCustomerByID/" + customerID
        );

        const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + customerID, { token: user.data.token })
        if (existingOrders.data.status == true) {
          setDraftMeasurementsObject(existingOrders.data.data[0]['measurements'])
        }


        setCustomer(res.data.data[0]);

        if (
          existingOrders.data.status == true
        ) {
          const drafts = JSON.parse(JSON.stringify(existingOrders.data.data[0]['measurements']))
          const objM = {}
          for (let x of Object.keys(drafts)) {

            customerMeasurements[x] = drafts[x]

            measurementsFinished[x] = true
            objM[x] = true
          }
          setCustomerMeasurements({ ...customerMeasurements });
          setMeasurementsFinished({ ...measurementsFinished })

          for (let x of orders) {
            if (!Object.keys(objM).includes(x.item_name)) {
              measurementsFinished[x['item_name']] = false
            }
          }
          setMeasurementsFinished({ ...measurementsFinished })
          //  setCustomerMeasurements(drafts)
          setFilledMeasurements(
            Object.keys(drafts)
          );
        } else if (
          res.data.data[0]["measurementsObject"] !== undefined &&
          res.data.data[0]["measurementsObject"] !== null
        ) {
          if (Object.keys(res.data.data[0]["measurementsObject"]).length > 0) {
            const objM = {}
            for (let x of Object.keys(res.data.data[0]["measurementsObject"])) {

              customerMeasurements[x] = res.data.data[0]["measurementsObject"][x]

              measurementsFinished[x] = true
              objM[x] = true
            }


            setMeasurementsFinished({ ...measurementsFinished })
            setCustomerMeasurements({ ...customerMeasurements });
            // setCustomerMeasurements(res.data.data[0]["measurementsObject"]);
            setFilledMeasurements(
              Object.keys(res.data.data[0]["measurementsObject"])
            );


            for (let x of orders) {
              if (!Object.keys(objM).includes(x.item_name)) {
                measurementsFinished[x['item_name']] = false
              }
            }
            setMeasurementsFinished({ ...measurementsFinished })
          }
          for (let x of Object.keys(productsMeasurementArray)) {
            if (!Object.keys(res.data.data[0]["measurementsObject"]).includes(x)) {
              const tempProductsMeassurement = JSON.parse(JSON.stringify(productsMeasurementArray[x]))
              customerMeasurements[x] = tempProductsMeassurement
              setCustomerMeasurements({ ...customerMeasurements })
            }
          }
        } else {
          const tempProductsMeassurement = JSON.parse(JSON.stringify(productsMeasurementArray))
          setCustomerMeasurements(tempProductsMeassurement)
        }

        if (
          res.data.data[0]["suit"] !== undefined &&
          res.data.data[0]["suit"] !== null
        ) {
          if (Object.keys(res.data.data[0]["suit"]).length > 0) {
            setSuitCustomerMeasurements(res.data.data[0]["suit"]);
            setSuitFilledMeasurement("suit");
            measurementsFinished['suit'] = true
            setMeasurementsFinished({ ...measurementsFinished })
          }
        } else {
          const tempSuitProductMeasurements = JSON.parse(JSON.stringify(suitProductsMeasurementArray))
          setSuitCustomerMeasurements(tempSuitProductMeasurements)
        }

        if (
          res.data.data[0]["tuxedo"] !== undefined &&
          res.data.data[0]["tuxedo"] !== null
        ) {
          if (Object.keys(res.data.data[0]["tuxedo"]).length > 0) {
            setTuxedoCustomerMeasurements(res.data.data[0]["tuxedo"]);
            setTuxedoFilledMeasurement("tuxedo");
            measurementsFinished['tuxedo'] = true
            setMeasurementsFinished({ ...measurementsFinished })
          }
        } else {
          const tempTuxedoProductMeasurements = JSON.parse(JSON.stringify(tuxedoProductsMeasurementArray))
          setTuxedoCustomerMeasurements(tempTuxedoProductMeasurements)
        }
      };

      fetchUserMeasurements();
    } else {
      for (let x of orders) {
        measurementsFinished[x.item_name] = false
      }
      setMeasurementsFinished({ ...measurementsFinished })
      if (Object.keys(productsMeasurementArray).length > 0) {
        const tempProductsMeassurement = JSON.parse(JSON.stringify(productsMeasurementArray))
        setCustomerMeasurements(tempProductsMeassurement)
      }
      if (Object.keys(suitProductsMeasurementArray).length > 0) {
        const tempSuitProductMeasurements = JSON.parse(JSON.stringify(suitProductsMeasurementArray))
        setSuitCustomerMeasurements(tempSuitProductMeasurements)
      }
      if (Object.keys(tuxedoProductsMeasurementArray).length > 0) {
        const tempTuxedoProductMeasurements = JSON.parse(JSON.stringify(tuxedoProductsMeasurementArray))
        setTuxedoCustomerMeasurements(tempTuxedoProductMeasurements)
      }
    }
  }, [customerID])

  const handleSelectCustomer = (e) => {
    if (!customerArray.includes(e.target.dataset.val)) {
      setCustomerID(e.target.dataset.val)
      setExistingCustomer(true)
      // setShowCustomerList("none")
      // setAllCustomers([])
    } else {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("Customer Already exists in the order.!");
    }

  }

  useEffect(() => {
    fetchAllCustomers()
  },[])

  const handleFetchCustomers = async (e, newInputValue) => {
    setCustomerID(newInputValue._id)
    setExistingCustomer(true)
    setSuccess(true);
    setOpen(true);
    setError(false);
    setSuccessMsg("Customer Added below.!");
    // if (e.target.value.length > 2) {
    //   const res = await axiosInstance.post("/userMeasurement/fetchCustomerByLike/" + e.target.value, { token: user.data.token })
    //   if (res.data.data.length > 0) {
    //     setAllCustomers(res.data.data)
    //     setShowCustomerList("block")
    //   }
    // }
    // if (!e.target.value.length > 0) {
    //   setShowCustomerList("none")
    //   setAllCustomers([])
    // }
  }
  // console.log("new customer: ", customer)
  const handleNext = async () => {

    if (!Object.values(measurementsFinished).includes(false)) {

      if (validator.isEmpty(customer.firstname)) {
        setValidationError({ firstname: customer.firstname.length === 0 })
      } else if (validator.isEmpty(customer.lastname)) {
        setValidationError({ lastname: customer.lastname.length === 0 })
      } else if (validator.isEmpty(customer.gender)) {
        setValidationError({ gender: customer.gender.length === 0 })
      } else {
        if (imageData) {
          const data = new FormData();
          data.append("image", imageData);
          const res = await axiosInstance.post("image/upload", data)
          customer.image = res.data.data
        }


        const res = await axiosInstance.post(
          "userMeasurement/createCustomer",
          customer,
          { token: user.data.token }
        )

        if (res.data.status == true) {
          setSuccess(true);
          setOpen(true);
          setError(false);
          setSuccessMsg("order created successfully!");
          if (!customerArray.includes(res.data.data['_id'])) {
            customerArray.push(res.data.data['_id'])
            setCustomerArray([...customerArray])
          }
          setCustomerID("")
          handleSaveGroupOrder()
          setOpenCustomerForm(false)
        } else {
          console.log(res.data.message)
          setSuccess(false);
          setOpen(true);
          setError(true);
          setErrorMsg(res.data.message);
        }

      }
    } else {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill all the neccessary information !");
    }
  };
  console.log("customr: ", customer)
  const handleUpdateNext = async () => {
    if (!Object.values(measurementsFinished).includes(false)) {

      if (validator.isEmpty(customer.firstname)) {
        setValidationError({ firstname: customer.firstname.length === 0 })
      } else if (validator.isEmpty(customer.lastname)) {
        setValidationError({ lastname: customer.lastname.length === 0 })
      } else if (validator.isEmpty(customer.gender)) {
        setValidationError({ gender: customer.gender.length === 0 })
      } else {
        if (imageData) {
          const data = new FormData();
          data.append("image", imageData);
          const res = await axiosInstance.post("image/upload", data)
          customer.image = res.data.data
        }


        const res = await axiosInstance.put(
          "userMeasurement/updateCustomerMeasurementsNewUpdate/" + customerID,
          { customer: customer, token: user.data.token }
        )

        if (res.data.status == true) {
          setSuccess(true);
          setOpen(true);
          setError(false);
          setSuccessMsg("order created successfully!");
          // setCustomer(res.data.data)
          if (!customerArray.includes(res.data.data['_id'])) {
            customerArray.push(res.data.data['_id'])
            setCustomerArray([...customerArray])
          }
          setCustomerID("")
          setOpenCustomerForm(false)
          setMeasurementsFinished({})
          handleSaveGroupOrder()
          // setTimeout(() => {
          //  closeCustomerForm()
          // }, 1000)
        } else {
          setSuccess(false);
          setOpen(true);
          setError(true);
          setErrorMsg(res.data.message);
        }

      }
    } else {
      setSuccess(false);
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill all the neccessary information !");
    }
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSuccess(false);
    setOpen(false)
    setError(false)
  };

  const handleOpenMeasurementForm = (e) => {
    setProduct_name(e.target.dataset.name)
    setOpenMeasurementForm(true)
  };

  const handleOpenSuitMeasurementForm = (e) => {
    setProduct_name('suit')
    setOpenMeasurementForm(true)
  };

  const handleOpenTuxedoMeasurementForm = (e) => {
    setProduct_name('tuxedo')
    setOpenMeasurementForm(true)
  };

  const fetchAllCustomers = async() => {
    const res = await axiosInstance.post("/userMeasurement/getCustomersMesurement/" + user.data.retailer_code, { token: user.data.token })
    if (res.data.data.length > 0) {
      setCustomerList(res.data.data)
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
      <div className="content-wrapper pd-1r">
        <div className="mb-5 steps-BTn_Nm">
          <div className="step-one-wrapper customer-input" style={{ display: "flex", alignItems: "center", width: "100%", borderBottom: "solid 1px #C2C2C3", paddingBottom: "20px" }}>
            {/* Label aligned to the left */}
            <label htmlFor="selectCustomer" style={{ fontSize: "18px", fontWeight: "bold", width: "20%", textAlign: "left" }}>
              Add Old Customers
            </label>

            {/* Input centered with increased width */}
            {/* <Stack spacing={2} sx={{ width: "100%" }}> */}
      <Autocomplete
        id="free-solo-demo"
        freeSolo
        options={customerList} // Use the entire object
        getOptionLabel={(option) => option.fullname} 
        renderInput={(params) => <TextField {...params} label="Search Customer" />}
        // onChange={handleFetchCustomers}
        onChange={handleFetchCustomers}
        sx={{ width: "100%" }}
      />
 
    {/* </Stack> */}
            {/* <input
              type="text"
              onChange={handleFetchCustomers}
              style={{
                flexGrow: 1,
                maxWidth: "100%",
                padding: "10px",
                fontSize: "16px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                textAlign: "center",
              }}
            /> */}
          </div>


          {/* <div style={{ display: showCustomerList }} className="customer-list">
            <ol>
              {allCustomers.map((singleCustomer) => {
                if (customerArray.includes(singleCustomer['_id'])) {
                  return (
                    <li style={{ color: "#9999A6" }} key={singleCustomer['_id']} data-val={singleCustomer['_id']} onClick={handleSelectCustomer}>{singleCustomer['firstname'] + " " + singleCustomer['lastname']}</li>

                  )
                } else {
                  return (
                    <li style={{ color: "green" }} key={singleCustomer['_id']} data-val={singleCustomer['_id']} onClick={handleSelectCustomer}>{singleCustomer['firstname'] + " " + singleCustomer['lastname']}</li>
                  )
                }

              })}
            </ol>
          </div> */}
          <div className="" style={{display: "flex", justifyContent: "center", borderBottom: "solid 1px #C2C2C3", marginBottom: "20px", paddinBottom:"0", fontSize: "20px", fontWeight: "bold"}}>
            <p>OR</p>
          </div>
          <div className="steop-one-wrapper">
            <h3 className="steper-title" style={{ fontSize: "18px", fontWeight: "bold", width: "20%", textAlign: "left" }}> Customer Registration </h3>
            <div className="step-formSteps">

              <div className="fileupload-box_NM">

                <label for="fileInput">

                  {
                    imageData
                      ?
                      <img
                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                        src={URL.createObjectURL(imageData)} alt="" className='uploaded-image' />
                      :
                      customer && customer['image']
                        ?
                        <img
                          style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                          src={PicBaseUrl + customer['image']} alt="" className='uploaded-image' />
                        :
                        <>
                          <AccountCircleIcon className='upload-image' color='primary'
                            style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                          />
                        </>
                  }

                  <h3>Add Photo</h3>

                </label>

                <input type="file" name='image' id="fileInput" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageData(e.target.files[0])} />

              </div>
              <div className={validationError.firstname ? "form-group error-handle" : "form-group"}>
                <label> First Name <span className="red-required">*</span></label>
                <input type="text" className="searchinput" value={customer.firstname} placeholder="James" onChange={(e) => setCustomer({ ...customer, firstname: e.target.value })} required />
              </div>
              <div className={validationError.lastname ? "form-group error-handle" : "form-group"}>
                <label> Last Name <span className="red-required">*</span></label>
                <input type="text" value={customer.lastname} className="searchinput" placeholder="Doe" onChange={(e) => setCustomer({ ...customer, lastname: e.target.value })} required />
              </div>
              <div className={validationError.gender ? "form-group error-handle" : "form-group"}>
                <label> Gender <span className="red-required">*</span></label>
                <select className="searchinput" value={customer.gender} onChange={(e) => setCustomer({ ...customer, gender: e.target.value })} required>
                  <option value="Select Gender"> Select Gender </option>
                  <option value="Male"> Male </option>
                  <option value="Female"> Female </option>
                  <option value="Other"> Other </option>
                </select>
              </div>
              <div className="form-group">
                <label> Email </label>
                <input type="email" className="searchinput" value={customer.email} placeholder="james@example.com" onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label> Contact </label>
                <input type="text" className="searchinput" value={customer.phone} placeholder="12345" onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />

              </div>
              <div className="form-group">
                <label> Customer Monogram Tag </label>
                <input type="text" className="searchinput" value={customer.tag} placeholder="Monogram Tag" onChange={(e) => setCustomer({ ...customer, tag: e.target.value })} />

              </div>
              <div className="image-note">
                <label> Customer Image Note</label>
                <textarea className="searchinput" value={customer.imageNote} onChange={(e) => setCustomer({ ...customer, imageNote: e.target.value })}></textarea>
              </div>
            </div>
          </div>
          <div className="steop-one-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>Measurement</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map((products, i) => {
                    return (
                      <tr key={i}>
                        <td>{products["item_name"].toUpperCase()}</td>
                        <td>
                          <span
                            value={products.item_name}
                            data-name={products.item_name}
                            onClick={
                              products.item_name === "suit"
                                ? handleOpenSuitMeasurementForm 
                                :
                                products.item_name === "tuxedo"
                                ? handleOpenTuxedoMeasurementForm
                                : handleOpenMeasurementForm
                            }
                            style={measurementsFinished[products.item_name] == true
                              ? completeMeasurementStyles
                              : missingMeasurementStyles}
                          >
                            {measurementsFinished[products.item_name] == true
                              //{filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name) 
                              ? "Complete"
                              : "Missing"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td style={{ color: "red" }}>Please select product here.....</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="steop-one-wrapper">
            {!existingCustomer
              ?
              <button
                className="next-button"
                variant="contained"
                color="primary"
                onClick={handleNext}
                type="submit"
              >
                Save Customer
              </button>
              :
              <button
                className="next-button"
                variant="contained"
                color="primary"
                onClick={handleUpdateNext}
                type="submit"
              >
                Update Customer
              </button>

            }
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
              <Alert
                onClose={handleClose}
                severity="error"
                sx={{ width: "100%" }}
              >
                {errorMsg}
              </Alert>
            </Snackbar>
          )}
        </div>
      </div>
      <div>
        <Dialog
          onClose={handleOpenMeasurementForm}
          open={openMeasurementForm}
          className={
            openMeasurementForm ? "rigth-sideModel mui_show" : "rigth-sideModel"
          }
        >
          <CustomerProductMeasurements
            customerMeasurements={customerMeasurements}
            setCustomerMeasurements={setCustomerMeasurements}
            suitcustomerMeasurements={suitcustomerMeasurements}
            setSuitCustomerMeasurements={setSuitCustomerMeasurements}
            tuxedocustomerMeasurements={tuxedocustomerMeasurements}
            setTuxedoCustomerMeasurements={setTuxedoCustomerMeasurements}
            product_name={product_name}
            setProduct_name={setProduct_name}
            customer={customer}
            setCustomer={setCustomer}
            filledMeasurements={filledMeasurements}
            setFilledMeasurements={setFilledMeasurements}
            setOpenMeasurementForm={setOpenMeasurementForm}
            draftMeasurementsObject={draftMeasurementsObject}
            measurementsFinished={measurementsFinished}
            setMeasurementsFinished={setMeasurementsFinished}
            productsMeasurementArray={productsMeasurementArray}

          // proType = {''}
          />
        </Dialog>
      </div>
    </main>
  );
};

export default NewCustomer;