import React, { useState, useContext } from "react";
import { Button } from "@material-ui/core";
import { axiosInstance } from "./../../../../config";
import './newCustomer.css';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { useNavigate } from "react-router-dom";
import validator from "validator";
import { Context } from "./../../../../context/Context";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
// import { PicBaseUrl } from "./../../../../imageBaseURL";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});





const NewCustomer = () => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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

  const navigate = useNavigate()



  const handleNext = async () => {


      if (validator.isEmpty(customer.firstname)) {
        setValidationError({ firstname: customer.firstname.length === 0 })
      } else if (validator.isEmpty(customer.lastname)) {
        setValidationError({ lastname: customer.lastname.length === 0 })
      } else if (validator.isEmpty(customer.gender)) {
        setValidationError({ gender: customer.gender.length === 0 })
      } else {
      if(imageData) {
        const data = new FormData();
        data.append("image", imageData);
        const res = await axiosInstance.post("image/upload", data)
        customer.image = res.data.data
      }

    
      const res = await axiosInstance.post(
        "userMeasurement/createCustomerMeasurement",
        customer,
        { token: user.data.token }
      )
      
      if (res.data.status == true) {
        setSuccess(true);
        setOpen(true);
        setError(false);
        setErrorMsg("order created successfully!");
        setTimeout(() => {
          navigate("/retailer/productList/" + res.data.data['_id']);
        }, 1000)
       } else {
        setSuccess(false);
        setOpen(true);
        setError(true);
        setErrorMsg(res.data.message);
      }

      }

    // } else if (activeStep == steps.length - 2) {
    //   if (validator.isEmpty(customer.firstname)) {
    //     setValidationError({ firstname: customer.firstname.length === 0 })
    //   } else if (validator.isEmpty(customer.lastname)) {
    //     setValidationError({ lastname: customer.lastname.length === 0 })
    //   } else if (validator.isEmpty(customer.gender)) {
    //     setValidationError({ gender: customer.gender.length === 0 })
    //   } else {
    //     setActiveStep(activeStep + 1)
    //   }
    // } else {

    //   setActiveStep(activeStep + 1)

    // }
  };




  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSuccess(false);
    setOpen(false)
    setError(false)
  };

  console.log(customer)
  console.log(imageData)



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

      <div className="steop-one-wrapper">
       <h3 className="steper-title"> Customer Registration </h3>
        <div className="step-formSteps">
          
          <div className="fileupload-box_NM">
              
              <label htmlFor="fileInput">
                
                {
                  imageData
                  ? 
                  <img 
                  style={{width: "200px", height: "200px", borderRadius: "50%" }}
                  src={URL.createObjectURL(imageData)} alt="" className='uploaded-image'/>
                  :
                  <>
                  <AccountCircleIcon className='upload-image' color='primary' 
                  style={{width: "200px", height: "200px", borderRadius: "50%" }}
                  />
                  </>
                } 

                <h3>Add Photo</h3>
                
              </label>
              
              <input type="file"  name='image'  id="fileInput"  className="inputfile-button" style={{display:'none'}}  onChange={(e)=>setImageData(e.target.files[0])}/>
             
          </div>
          <div className={validationError.firstname ? "form-group error-handle" : "form-group"}>
            <label> First Name <span className="red-required">*</span></label>
            <input type="text" className="searchinput" value={customer.firstname} placeholder="James" onChange={(e)=>setCustomer({...customer, firstname:e.target.value})} required/>
          </div>
          <div className={validationError.lastname ? "form-group error-handle" : "form-group"}>
            <label> Last Name <span className="red-required">*</span></label>
            <input type="text" value={customer.lastname} className="searchinput" placeholder="Doe" onChange={(e)=>setCustomer({...customer, lastname:e.target.value})} required/>
          </div>
          <div className={validationError.gender ? "form-group error-handle" : "form-group"}>
            <label> Gender <span className="red-required">*</span></label>
             <select className="searchinput" value={customer.gender} onChange={(e)=>setCustomer({...customer, gender:e.target.value})} required>
                <option value="Select Gender"> Select Gender </option>
                <option value="Male"> Male </option>
                <option value="Female"> Female </option>
                <option value="Other"> Other </option>
             </select>
          </div>
          <div className="form-group">
            <label> Email </label>
            <input type="email" className="searchinput" value={customer.email} placeholder="james@example.com" onChange={(e)=>setCustomer({...customer, email:e.target.value})}/> 
          </div>
          <div className="form-group">
            <label> Contact </label>
            <input type="text" className="searchinput" value={customer.phone} placeholder="12345" onChange={(e)=>setCustomer({...customer, phone:e.target.value})}/>
          
          </div>
            <div className="image-note">
             <label> Customer Image Note</label>
             <textarea className="searchinput" value={customer.imageNote} onChange={(e)=>setCustomer({...customer, imageNote:e.target.value})}></textarea>
            </div>        
       </div>
    </div>

    <button
              className="next-button"
              variant="contained"
              color="primary"
              onClick={handleNext}
              type="submit"
            >
             Save Customer
            </button>



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
                New Customer created!
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
    </main>
  );
};

export default NewCustomer;

// import React, { useState, useContext } from "react";
// import { Button, Stepper, Step, StepLabel } from "@material-ui/core";
// import { axiosInstance } from "./../../../../config";
// import { makeStyles } from "@material-ui/core/styles";
// import { FormProvider } from "react-hook-form";
// import './newCustomer.css'
// import Step1 from "../Step1/Step1"
// import Step2 from '../Step2/Step2'
// import Step3 from '../Step3/Step3'
// import Step4 from '../Step4/Step4'
// // import Step5 from '../Step3/Step3'
// import IconButton from "@mui/material/IconButton";
// import CloseIcon from "@mui/icons-material/Close";
// import Snackbar from "@mui/material/Snackbar";
// import MuiAlert from "@mui/material/Alert";
// import { useNavigate } from "react-router-dom";
// import validator from "validator";
// import { Context } from "./../../../../context/Context";

// const Alert = React.forwardRef(function Alert(props, ref) {
//   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// });

// const useStyles = makeStyles((theme) => ({
//   button: {
//     marginRight: theme.spacing(1),
//   },
// }));

// function getSteps() {
//   return [
//     "Account",
//     "Personal",
//     // "Product",
//     // "Final"
//   ];
// }

// const NewCustomer = () => {
//   const [activeStep, setActiveStep] = useState(0)
//   const steps = getSteps();
//   const [open, setOpen] = useState(false);
//   const [error, setError] = useState(false);
//   const [success, setSuccess] = useState(false);
//   const [errorMsg, setErrorMsg] = useState("");
//   const [validationError, setValidationError] = useState({
//     firstname: false,
//     lastname: false,
//     gender: false
//   })
//   const { user } = useContext(Context);
//   const [customer, setCustomer] = useState({
//     firstname: "",
//     lastname: "",
//     gender: "",
//     email: "",
//     city: "",
//     country: "",
//     phone: "",
//     retailer_code: user.data.retailer_code,
//     retailer_name: user.data.retailer_name,
//     measurementsObject: {},
//     image: "",
//     imageNote: ""
//   });

//   const navigate = useNavigate()

//   function getStepContent(step) {
//     switch (step) {
//       case 0:
//         return <Step1 customer={customer} setCustomer={setCustomer} validationError={validationError} />
//       case 1:
//         return <Step2 customer={customer} setCustomer={setCustomer} />
//       default:
//         return "unknown step";
//     }
//   }

//   const handleNext = async () => {

//     if (activeStep == steps.length - 1) {

      // if(customer.image) {
      //   const data = new FormData();
      //   data.append("image", customer.image);
      //   const res = await axiosInstance.post("image/upload", data)
      //   customer.image = `${res.data.data.split("/")[1]}.png`
      // }
//       const res = await axiosInstance.post(
//         "userMeasurement/createCustomerMeasurement",
//         customer,
//         { token: user.data.token }
//       )
//       // console.log(res.data.data)
//       if (res.data.status == true) {
//         setSuccess(true);
//         setOpen(true);
//         // setError(false);
//         // setsetErrorMsg("customer created successfully!");
//         setTimeout(() => {
//           navigate("/retailer/productList/" + res.data.data['_id']);
//         },1000)
       
//       } else {
//         setOpen(true);
//         setError(true);
//         setErrorMsg(res.data.message);
//       }


//     } else if (activeStep == steps.length - 2) {
//       if (validator.isEmpty(customer.firstname)) {
//         setValidationError({ firstname: customer.firstname.length === 0 })
//       } else if (validator.isEmpty(customer.lastname)) {
//         setValidationError({ lastname: customer.lastname.length === 0 })
//       } else if (validator.isEmpty(customer.gender)) {
//         setValidationError({ gender: customer.gender.length === 0 })
//       } else {
//         setActiveStep(activeStep + 1)
//       }
//     } else {

//       setActiveStep(activeStep + 1)

//     }
//   };

//   const handleBack = () => {
//     setActiveStep(activeStep - 1);
//   };


//   const handleClose = (event, reason) => {
//     if (reason === "clickaway") {
//       return;
//     }
//     setSuccess(false);
//     setOpen(false)
//     setError(false)
//   };

//   const handleJustCheck = (e, key) => {
//     if (key == "Personal") {
//       setActiveStep(1)
//     }
//     if (key == "Account") {
//       setActiveStep(0)
//     }
//   }

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

//   return (
//     <main className="main-panel">
//       <div className="content-wrapper pd-1r">
//         <div className="mb-5 steps-BTn_Nm">
//           <Stepper alternativeLabel activeStep={activeStep}>
//             {steps.map((step) => {
//               return (
//                 <Step key={step} name={step} onClick={(e, key) => handleJustCheck(e, step)}>
//                   <StepLabel ></StepLabel>
//                 </Step>
//               )
//             })}
//           </Stepper>

//           <FormProvider>
//             {getStepContent(activeStep)}
//             <button
//               className={activeStep === 0 ? "back-btn" : "back-button"}
//               onClick={handleBack}
//             >
//               Back
//             </button>
//             <button
//               className="next-button"
//               variant="contained"
//               color="primary"
//               onClick={handleNext}
//               type="submit"
//             >
//               {activeStep === steps.length - 1 ? "Save Customer" : "Next"}
//             </button>
//           </FormProvider>

//           {success && (
//             <Snackbar
//               open={open}
//               autoHideDuration={2000}
//               onClose={handleClose}
//             >
//               <Alert
//                 onClose={handleClose}
//                 // severity="success"
//                 sx={{ width: "100%", color:"green"}}
//               >
//                 New Customer created!
//               </Alert>
//             </Snackbar>
//           )}
//           {error && (
//             <Snackbar
//               open={open}
//               autoHideDuration={2000}
//               onClose={handleClose}
//               action={action}
//             >
//               <Alert
//                 onClose={handleClose}
//                 severity="error"
//                 sx={{ width: "100%" }}
//               >
//                 {errorMsg}
//               </Alert>
//             </Snackbar>
//           )}
//         </div>
//       </div>
//     </main>
//   );
// };

// export default NewCustomer;

// // 

// // import { Button, Stepper, Step, StepLabel } from "@material-ui/core";
// // import { axiosInstance } from "./../../../../config";
// // import { makeStyles } from "@material-ui/core/styles";
// // import { FormProvider } from "react-hook-form";
// // import './newCustomer.css'
// // import Step1 from "../Step1/Step1"
// // import Step2 from '../Step2/Step2'
// // import Step3 from '../Step3/Step3'
// // import Step4 from '../Step4/Step4'
// // // import Step5 from '../Step3/Step3'
// // import IconButton from "@mui/material/IconButton";
// // import CloseIcon from "@mui/icons-material/Close";
// // import Snackbar from "@mui/material/Snackbar";
// // import MuiAlert from "@mui/material/Alert";
// // import { useNavigate } from "react-router-dom";
// // import validator from "validator";
// // import { Context } from "./../../../../context/Context";

// // const Alert = React.forwardRef(function Alert(props, ref) {
// //   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// // });

// // const useStyles = makeStyles((theme) => ({
// //   button: {
// //     marginRight: theme.spacing(1),
// //   },
// // }));

// // function getSteps() {
// //   return [
// //     "Account",
// //     "Personal",
// //     // "Product",
// //     // "Final"
// //   ];
// // }

// // const NewCustomer = () => {
// //   const [activeStep, setActiveStep] = useState(0)
// //   const steps = getSteps();
// //   const [open, setOpen] = useState(false);
// //   const [error, setError] = useState(false);
// //   const [success, setSuccess] = useState(false);
// //   const [errorMsg, setErrorMsg] = useState("");
// //   const [validationError, setValidationError] = useState({
// //     firstname: false,
// //     lastname: false,
// //     gender: false
// //   })
// //   const { user } = useContext(Context);
// //   const [orders, setOrders] = useState([])
// //   const [totalQuantity, setTotalQuantity] = useState(0);
// //   const [customer, setCustomer] = useState({
// //     firstname: "",
// //     lastname: "",
// //     gender: "",
// //     email: "",
// //     city: "",
// //     country: "",
// //     phone: "",
// //     retailer_code: user.data.retailer_code,
// //     retailer_name: user.data.retailer_name,
// //     measurementsObject: {},
// //     image: "",
// //     imageNote: "",
// //     order: {
// //       order_quantity: [],
// //       total_quantity: 0
// //     }
// //   });

// //   const navigate = useNavigate()

// //   function getStepContent(step) {
// //     switch (step) {
// //       case 0:
// //         return <Step1 customer={customer} setCustomer={setCustomer} validationError={validationError} />
// //       case 1:
// //         return <Step2 customer={customer} setCustomer={setCustomer} />
// //       default:
// //         return "unknown step";
// //     }
// //   }

// //   const handleNext = async () => {

// //     if (activeStep == steps.length - 1) {

// //       customer['order']['order_quantity'] = orders;
// //       customer['order']['total_quantity'] = totalQuantity;

// //       setCustomer({ ...customer });

// //       const res = await axiosInstance.post(
// //         "userMeasurement/createCustomerMeasurement",
// //         customer,
// //         { token: user.data.token }
// //       )
// //       console.log(res.data.data)
// //       if (res.data.status == true) {
// //         setSuccess(true);
// //         setOpen(true);
// //         setError(false);
// //         setErrorMsg("order created successfully!");
// //         navigate("/retailer/productList/" + res.data.data['_id']);
// //       } else {
// //         setSuccess(false);
// //         setOpen(true);
// //         setError(true);
// //         setErrorMsg(res.data.message);
// //       }


// //     } else if (activeStep == steps.length - 2) {
// //       if (validator.isEmpty(customer.firstname)) {
// //         setValidationError({ firstname: customer.firstname.length === 0 })
// //       } else if (validator.isEmpty(customer.lastname)) {
// //         setValidationError({ lastname: customer.lastname.length === 0 })
// //       } else if (validator.isEmpty(customer.gender)) {
// //         setValidationError({ gender: customer.gender.length === 0 })
// //       } else {
// //         setActiveStep(activeStep + 1)
// //       }
// //     } else {

// //       setActiveStep(activeStep + 1)

// //     }
// //   };

// //   const handleBack = () => {
// //     setActiveStep(activeStep - 1);
// //   };


// //   const handleClose = (event, reason) => {
// //     if (reason === "clickaway") {
// //       return;
// //     }
// //     setSuccess(false);
// //     setOpen(false)
// //     setError(false)
// //   };

// //   const handleJustCheck = (e, key) => {
// //     if (key == "Personal") {
// //       setActiveStep(1)
// //     }
// //     if (key == "Account") {
// //       setActiveStep(0)
// //     }
// //   }

// //   const action = (
// //     <React.Fragment>
// //       <Button color="secondary" size="small" onClick={handleClose}>
// //         UNDO
// //       </Button>
// //       <IconButton
// //         size="small"
// //         aria-label="close"
// //         color="inherit"
// //         onClick={handleClose}
// //       >
// //         <CloseIcon fontSize="small" />
// //       </IconButton>
// //     </React.Fragment>
// //   );

// //   return (
// //     <main className="main-panel">
// //       <div className="content-wrapper pd-1r">
// //         <div className="mb-5 steps-BTn_Nm">
// //           <Stepper alternativeLabel activeStep={activeStep}>
// //             {steps.map((step) => {
// //               return (
// //                 <Step key={step} name={step} onClick={(e, key) => handleJustCheck(e, step)}>
// //                   <StepLabel ></StepLabel>
// //                 </Step>
// //               )
// //             })}
// //           </Stepper>

// //           <FormProvider>
// //             {getStepContent(activeStep)}
// //             <button
// //               className={activeStep === 0 ? "back-btn" : "back-button"}
// //               onClick={handleBack}
// //             >
// //               Back
// //             </button>
// //             <button
// //               className="next-button"
// //               variant="contained"
// //               color="primary"
// //               onClick={handleNext}
// //               type="submit"
// //             >
// //               {activeStep === steps.length - 1 ? "Save Customer" : "Next"}
// //             </button>
// //           </FormProvider>

// //           {success && (
// //             <Snackbar
// //               open={open}
// //               autoHideDuration={2000}
// //               onClose={handleClose}
// //             >
// //               <Alert
// //                 onClose={handleClose}
// //                 severity="success"
// //                 sx={{ width: "100%" }}
// //               >
// //                 New Customer created!
// //               </Alert>
// //             </Snackbar>
// //           )}
// //           {error && (
// //             <Snackbar
// //               open={open}
// //               autoHideDuration={2000}
// //               onClose={handleClose}
// //               action={action}
// //             >
// //               <Alert
// //                 onClose={handleClose}
// //                 severity="error"
// //                 sx={{ width: "100%" }}
// //               >
// //                 {errorMsg}
// //               </Alert>
// //             </Snackbar>
// //           )}
// //         </div>
// //       </div>
// //     </main>
// //   );
// // };

// // export default NewCustomer;