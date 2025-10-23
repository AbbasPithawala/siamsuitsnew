import React from "react";
import "./factory.css";
import { Link } from "react-router-dom";
import { useState, useEffect, useContext, useRef } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import QrScanner from "qr-scanner";
import { Html5QrcodeScanner } from "html5-qrcode";

import { generateJobPDF } from "../../../../utils/pdfGenerator";


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});
export default function AssignItem(){
  const [jobs, setJobs] = useState([]);
  const { user } = useContext(Context);
  const [showJob, setShowJob] = useState(false);
  const [showQRInput, setShowQRInput] = useState(false);
  const [showExtraPaymentCategories, setShowExtraPaymentCategories] = useState(false)

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [tailors, setTailors] = useState([]);
  const [tailor, setTailor] = useState({});
  const [costChk, setCostChk] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [today , setToday] = useState(new Date().toLocaleDateString("es-CL"));
  const[jobIDArray, setJobIDArray] = useState([]);  
  const [qrCode, setQrCode] = useState("");
  const [extraPaymentCategories, setExtraPaymentCategories] = useState([])
  const [showRetailers, setShowRetailers] = useState(false)
  const [jobId, setJobId] = useState("")
  const [checkboxItem, setCheckboxItem] = useState([])
  const [orderType, setOrderType] = useState("normal")
  const [unfinishedJobs, setUnfinishedJobs] = useState([])
  
  // QR Scanner states
  const [showCamera, setShowCamera] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [useAlternativeScanner, setUseAlternativeScanner] = useState(false);
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const html5QrScannerRef = useRef(null);
  const [showUnfinishedJobs, setShowUnfinishedJobs] = useState(false)
  const [extraPaymentCategoriesSelectedCost, setExtraPaymentCategoriesSelectedCost] = useState(0)

  // extra payment states=======================================

  // const [workerExtraPayment, setWorkerExtraPayment] = useState({});
  // const [workerExtraPayments, setWorkerExtraPayments] = useState([]);
  // const [showWorkerExtraPayments, setShowWorkerExtraPayments] = useState(false);
  // const[extraPaymentsIDArray, setExtraPaymentsIDArray] = useState([]);

  // payment States======================================
  const [tailorAdvance, setTailorAdvance] = useState(0);
  const [deductedAdvance, setDeductedAdvance] = useState(0);
  const [subTotal, setSubTotal] = useState(0);
  const [manualBill, setManualBill] = useState(0);
  const [totalPay, setTotalPay] = useState(0);  
  const [rent, setRent] = useState(0);



  useEffect(() => {
    fetchTailors();
    fetchExtraPaymentCategories();
  }, []);

  useEffect(() => {

  }, [unfinishedJobs])

  const handleClickOpen = (id) => {
    setOpen2(true);
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleOpenExtraPaymentCategories = () => {
    setShowExtraPaymentCategories(true)
  }

  
  //  const handleDelete = async () => {
  //    const res = await axiosInstance.post(`/position/delete/${positionId}`, {token:user.data.token})
  //    if(res){
  //     const res1 = await axiosInstance.post("/position/fetchAll", {token:user.data.token})
  //     setPositions(res1.data.data)
  //    }
  //    setOpen2(false)
  //    setOpen(true)
  //    setSuccess(true)
  //  }


  const searchSelectChange = (e) => {
    const tailorObject = tailors.filter((data) => data._id == e.target.value);
    setTailor(tailorObject[0]);
    setShowQRInput(true);
    fetchUnfinishedJobs(tailorObject[0])
    setShowUnfinishedJobs(true)
  };

  // const handleSearch = () => {
  //   const obj = {
  //     tailor: tailor['_id']
  //   };
  //   if(startDate.length > 0){
  //     obj['startDate'] = startDate
  //   }
  //   if(endDate.length > 0){
  //     obj['endDate'] = startDate
  //   }
  //   // fetchJobs(obj);
  //   setTailorAdvance(tailor['advancePayment'])
  // }
console.log("checkboxItem", checkboxItem)
  const handleCheckboxChange = async(e, cst) =>{
    
    if(e.target.checked){
      if(!checkboxItem.includes(e.target.value)){
      setCheckboxItem([...checkboxItem, e.target.value])
      let epcsc = extraPaymentCategoriesSelectedCost
      epcsc = epcsc + Number(cst)
      setExtraPaymentCategoriesSelectedCost(epcsc)
      }
    }else{
      const updatedSelectedItem = checkboxItem.filter(
        (selectedItem) => selectedItem !== e.target.value
      );
      let epcsc = extraPaymentCategoriesSelectedCost
      epcsc = epcsc - Number(cst)
      setExtraPaymentCategoriesSelectedCost(epcsc)      
      setCheckboxItem(updatedSelectedItem);
    }
   }


   const handleCreateExtraPayment = async(e) => {
    setShowExtraPaymentCategories(false)
   }

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setError(false)
    setSuccess(false);
    setOpen(false);
  };

  const handleDeductAdvance = (e) => {
  if(!costChk.length > 0){
    setError(true)
    setSuccess(false)
    setErrorMsg("Please Select an Order First !.")
  } 
  else{ 
    if(Number(e.target.value) > tailorAdvance){
      setError(true)
      setSuccess(false)
      setErrorMsg("Deducted advance cannot be more than total Advance !.")
    }else{
      setDeductedAdvance(Number(e.target.value))
      const totP = (Number(subTotal) + Number(manualBill) + Number(rent))- Number(e.target.value) 
      setTotalPay(totP)
    }
  }
  }

  const handleManualBill = (e) => {
    if(!costChk.length > 0){
      setError(true)
      setSuccess(false)
      setErrorMsg("Please Select an Order First !.")
    } 
    else{ 
    setManualBill(Number(e.target.value))
    const totP = (Number(subTotal) + Number(e.target.value) + Number(rent))- Number(deductedAdvance) 
    setTotalPay(totP)
    }
  }
  
  const handleRent = (e) => {
    if(!costChk.length > 0){
      setError(true)
      setSuccess(false)
      setErrorMsg("Please Select an Order First !.")
    } 
    else{ 
    setRent(Number(e.target.value))
    const totP = (Number(subTotal) + Number(e.target.value) + Number(manualBill))- Number(deductedAdvance) 
    setTotalPay(totP)
    }
  }

  // const handleSubmitPayment = async(e) => {
  //   if(totalPay > 0){
  //     let paymentObj = {
  //       deductedAdvance: deductedAdvance,
  //       subTotal: subTotal,
  //       totalPay: totalPay,
  //       tailorAdvance: tailorAdvance,
  //       manualBill: manualBill,
  //       rent: rent,
  //       tailor: tailor['_id'],
  //       job: jobIDArray,
  //       // extraPaymentCategory: extraPaymentsIDArray
  //     }

  //     if(jobIDArray.length > 0){
  //       for(let x of jobIDArray){
  //         let updateObject = {
  //           paid: true,
  //           paidDate: Date.now()
  //         }
  //         const res = await axiosInstance.put('/job/update/' + x, {token: user.data.token, job: updateObject})
  //         if(res.data.status == true){
  //           setError(false)
  //           setSuccess(true)
  //           setSuccessMsg(res.data.message)
  //         }else{
  //           setError(true)
  //           setSuccess(false)
  //           setErrorMsg(res.data.message)
  //         }
  //       }
  //     }

  //     // if(extraPaymentsIDArray.length > 0){
  //     //   for(let x of extraPaymentsIDArray){
  //     //     let yupdateObject = {
  //     //       paid: true,
  //     //       paidDate: Date.now()
  //     //     }
  //     //     const res = await axiosInstance.put('/workerExtraPayments/update/' + x, {token: user.data.token, extraPayment: yupdateObject})
  //     //     if(res.data.status == true){
  //     //       setError(false)
  //     //       setSuccess(true)
  //     //       setSuccessMsg(res.data.message)
  //     //     }else{
  //     //       setError(true)
  //     //       setSuccess(false)
  //     //       setErrorMsg(res.data.message)
  //     //     }
  //     //   }
  //     // }

  //     const advp = Number(tailor['advancePayment']) - Number(deductedAdvance)
  //     const obj = {
  //       advancePayment: advp
  //     }

  //     updateTailor(obj)

  //     // createPayment(paymentObj)


  //   }
  // }

console.log("jobs ", jobs)
  const handleAssignItem = async (e) => {
    const qrData = qrCode.split("/")
    if(qrData.length === 2){
      const type = "normal";
      setOrderType("normal")
      const order = qrCode.split("/")[0]
      const item = qrCode.split("/")[1]
      const res = await axiosInstance.post("/tailer/assignItem", {
        token: user.data.token,
        tailor: tailor,
        item: item,
        order: order,
        type: type
      })

      if(res.data.status === true){
        setShowUnfinishedJobs(false)
        // jobs.push(res.data.data)
        setJobs(res.data.data)
        setShowJob(true)
        setSuccess(true)
        setError(false)
        setSuccessMsg(res.data.message)
      }else{
        if(res.data.status === false){
          setSuccess(false)
          setError(true)
          setErrorMsg(res.data.message)
        }
      }

    }
    else if(qrData.length === 3){
      const type = "group";
      
      setOrderType("group")
      const order = qrCode.split("/")[0]
      const item = qrCode.split("/")[1]
      const customer = qrCode.split("/")[2]
      const res = await axiosInstance.post("/tailer/assignItem", {
        token: user.data.token,
        tailor: tailor,
        item: item,
        order: order,
        type: type,
        customer: customer
      })

      if(res.data.status === true){
        setShowJob(true)
        setJobs(res.data.data)
        setSuccess(true)
        setError(false)
        setSuccessMsg(res.data.message)
      }else{
        if(res.data.status === false){
          setSuccess(false)
          setError(true)
          setErrorMsg(res.data.message)
        }
      }
    }
  }

  const handleSelectJob = (e) =>{
    setJobId(e.target.dataset.jobid)
    setShowRetailers(true)
  }

    const handleEditJob = async (e) => {
    const par = {
      tailor: e.target.dataset.tailorid
    }
    updateJobsForWorkers(par)

 
  
  }

  // ======================================================================
  // ========================== QR Scanner Functions ===========================
  // ======================================================================

  const checkCameraPermissions = async () => {
    try {
      // First check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device");
      }

      // Check camera permission status
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'camera' });
        console.log("Camera permission status:", permission.state);
      }

      // Try to get user media first to ensure camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Prefer back camera
        } 
      });
      
      // Stop the stream immediately - we just needed to check permissions
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error("Camera permission check failed:", error);
      throw error;
    }
  };

  const startScanner = async () => {
    try {
      setIsScanning(true);
      setCameraError("");
      
      // First check camera permissions explicitly
      await checkCameraPermissions();
      
      if (videoRef.current && !qrScannerRef.current) {
        // Create new QR scanner instance
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            // Handle successful scan
            setQrCode(result.data);
            setScanResult(result.data);
            setShowCamera(false);
            setIsScanning(false);
            
            // Stop the scanner
            if (qrScannerRef.current) {
              qrScannerRef.current.stop();
            }
            
            // Show success message
            setSuccess(true);
            setSuccessMsg("QR Code scanned successfully!");
          },
          {
            preferredCamera: 'environment', // Use back camera on mobile
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          }
        );

        // Start scanning
        await qrScannerRef.current.start();
        setIsScanning(true);
      }
    } catch (error) {
      console.error("QR Scanner Error:", error);
      setIsScanning(false);
      
      let errorMessage = "Camera access failed. Please ensure camera permissions are granted.";
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and refresh the page.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Camera not supported on this device or browser.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is already in use by another application.";
      } else if (error.message.includes('not supported')) {
        errorMessage = "Camera not supported on this device.";
      }
      
      setCameraError(errorMessage);
      setError(true);
      setErrorMsg(errorMessage);
    }
  };

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
    setShowCamera(false);
    setCameraError("");
  };

  const startAlternativeScanner = () => {
    try {
      setIsScanning(true);
      setCameraError("");
      
      if (!html5QrScannerRef.current) {
        html5QrScannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2,
          },
          false
        );

        html5QrScannerRef.current.render(
          (decodedText, decodedResult) => {
            // Handle successful scan
            setQrCode(decodedText);
            setScanResult(decodedText);
            setShowCamera(false);
            setIsScanning(false);
            
            // Clear scanner
            if (html5QrScannerRef.current) {
              html5QrScannerRef.current.clear();
              html5QrScannerRef.current = null;
            }
            
            // Show success message
            setSuccess(true);
            setSuccessMsg("QR Code scanned successfully!");
          },
          (error) => {
            // Handle scan error (but don't show error for every failed attempt)
            console.log("Scan attempt:", error);
          }
        );
      }
    } catch (error) {
      console.error("Alternative scanner failed:", error);
      setIsScanning(false);
      setCameraError("Unable to start camera scanner. Please try manual input.");
    }
  };

  const stopAlternativeScanner = () => {
    if (html5QrScannerRef.current) {
      html5QrScannerRef.current.clear();
      html5QrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  const requestCameraPermission = async () => {
    try {
      setCameraError("");
      setIsScanning(true);
      
      // Request camera permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' 
        } 
      });
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      // If successful, start the scanner
      setTimeout(() => {
        if (useAlternativeScanner) {
          startAlternativeScanner();
        } else {
          startScanner();
        }
      }, 100);
      
    } catch (error) {
      console.error("Permission request failed:", error);
      setIsScanning(false);
      
      if (error.name === 'NotAllowedError') {
        setCameraError("Camera permission denied. Please go to your browser settings and allow camera access for this site, then refresh the page.");
      } else {
        setCameraError("Unable to access camera. Please check your device settings.");
      }
    }
  };

  const tryAlternativeScanner = () => {
    setUseAlternativeScanner(true);
    setCameraError("");
    setTimeout(() => {
      startAlternativeScanner();
    }, 100);
  };

  const toggleCamera = async () => {
    if (showCamera) {
      if (useAlternativeScanner) {
        stopAlternativeScanner();
      } else {
        stopScanner();
      }
    } else {
      setShowCamera(true);
      // Small delay to ensure video element is rendered
      setTimeout(() => {
        if (useAlternativeScanner) {
          startAlternativeScanner();
        } else {
          startScanner();
        }
      }, 100);
    }
  };

  const clearQrCode = () => {
    setQrCode("");
    setScanResult("");
    setCameraError("");
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      }
      if (html5QrScannerRef.current) {
        html5QrScannerRef.current.clear();
      }
    };
  }, []);

  // ======================================================================
  // ========================== static function ===========================
  // ======================================================================

  // const fetchJobs = async (par = null) => {
  //   par['paid'] = false
  //   par['status'] = true
  //     const res = await axiosInstance.post("/job/fetchAll", {
  //       token: user.data.token,
  //       par: par,
  //     });

  //     if (res.data.status == true) {
  //       if(startDate.length > 0 && !endDate.length > 0){  
  //         const jobsArray = res.data.data.filter((job) => job.date > new Date(startDate).getTime())
  //         setJobs(jobsArray)
  //       setShowJobs(true);
  //       }
  //       if(!startDate.length > 0 && endDate.length > 0){
  //         const jobsArray = res.data.data.filter((job) => job.date < new Date(endDate).getTime())
  //         setJobs(jobsArray)
  //         setShowJobs(true);
  //       }
  //       if(startDate.length > 0 && endDate.length > 0){
  //         const jobsArray = res.data.data.filter((job) => {
  //           return  new Date(startDate).getTime() < job.date  && job.date < new Date(endDate).getTime()
  //         })
  //         setJobs(jobsArray)
  //         setShowJobs(true);
  //       }
  //       if(!startDate.length > 0 && !endDate.length > 0){
  //        setJobs(res.data.data)
  //       setShowJobs(true);
  //       }
  //     } else {
  //       setShowJobs(false);
  //       setJobs([]);
  //     }
    
  // };

  const fetchTailors = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", {
      token: user.data.token,
    });
    setTailors(res.data.data);
  };

  const fetchUnfinishedJobs = async(tailId) => {
    const res = await axiosInstance.post('/job/fetchUnfinishedJobs', 
    {
      token: user.data.token,
      
      par: {
        tailor : tailId,
        status: false
      }
    })
    if(res.data.status == true){
      setUnfinishedJobs(res.data.data)
      setShowUnfinishedJobs(true)
    }else{      
      setUnfinishedJobs([])
      setShowUnfinishedJobs(false)
    }
  }

  const fetchExtraPaymentCategories = async() => {
    const res = await axiosInstance.post('/extraPaymentCategory/fetchAll', {token: user.data.token})
    if(res.data.status == true){
      setExtraPaymentCategories(res.data.data)
    }
  }

  const updateJobsForWorkers = async(par = null) => {
    const res = await axiosInstance.put("/job/updateWorker/" + jobId, {
      token: user.data.token,
      par:par
    })
    if(res.data.status == true){
        setShowRetailers(false)
    }
  }

  const updateJobs = async(par, jid) => {
    const thisJob = unfinishedJobs.filter((j) => j['_id'] === jid)
    let type = "normal"
    if(thisJob[0]['group_order_id']){
      type = "group"
    }
    const res = await axiosInstance.post("/job/processFinish", {
      token: user.data.token,
      order: thisJob[0]['order_id'] ?  thisJob[0]['order_id']['orderId'] :  thisJob[0]['group_order_id']['orderId'],
      item: thisJob[0]['item_code'].split("/")[1],
      type: type,
      customer: thisJob[0]['customer'],
      process:{
        name: thisJob[0]['process']['name']
      }
    })
    if(res.data.status == true){
        fetchUnfinishedJobs(tailor["_id"])
    }
  }
  // ======================================================================
  // ======================================================================
  // ======================================================================

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

  const handleGeneratePDF = async (job) => {
    await generateJobPDF({
      job,
      extraPaymentCategories,
      selectedExtraPayments: checkboxItem,
      selectedExtraPaymentsCost: extraPaymentCategoriesSelectedCost,
      jobType: 'job',
      printType: 'new'
    });
  }

  const handlePrintSlipWithCompletion = async (job, jobId = null) => {
    try {
      const currentJobId = jobId || job['_id']; // Handle both contexts
      
      // Step 1: Create extra payments ONLY if:
      // - Process includes 'stitching' AND
      // - User has selected extra payments (checkboxItem.length > 0)
      if (checkboxItem.length > 0) {
        let orderID = "";
        let type = "normal";
        
        if(job['order_id']){
          orderID = job['order_id'];
        } else {
          type = "group";
          orderID = job['group_order_id'];
        }
        
        const extraPaymentRes = await axiosInstance.post("/tailer/createExtraPayment", {
          token: user.data.token,
          tailor: tailor['_id'],
          item: job['item_code'],
          type: type,
          order: orderID,
          extraPayments: checkboxItem,
          job: currentJobId
        });
        
        if (!extraPaymentRes.data.status) {
          setError(true);
          setSuccess(false);
          setErrorMsg(extraPaymentRes.data.message);
          return;
        }
      }

      // Step 2: Update job status to finished (similar to handleFinishJob/updateJobs)
      let orderType = "normal";
      if(job['group_order_id']){
        orderType = "group";
      }
      
      const jobFinishRes = await axiosInstance.post("/job/processFinish", {
        token: user.data.token,
        order: job['order_id'] ? job['order_id']['orderId'] : job['group_order_id']['orderId'],
        item: job['item_code'].split("/")[1],
        type: orderType,
        customer: job['customer'],
        process: {
          name: job['process']['name']
        }
      });
      
      if (!jobFinishRes.data.status) {
        setError(true);
        setSuccess(false);
        setErrorMsg("Failed to complete job");
        return;
      }

      // Step 3: Generate PDF
      await generateJobPDF({
        job,
        extraPaymentCategories,
        selectedExtraPayments: checkboxItem,
        selectedExtraPaymentsCost: extraPaymentCategoriesSelectedCost,
        jobType: 'job',
        printType: 'new'
      });

      // Step 4: Reset UI state and refresh data
      if (jobId) {
        // Called from unfinished jobs table
        fetchUnfinishedJobs(tailor["_id"]);
      } else {
        // Called from single job view
        setShowJob(false);
        setExtraPaymentCategoriesSelectedCost(0);
        setJobs([]);
        setCheckboxItem([]);
        fetchUnfinishedJobs(tailor['_id']);
      }
      
      setSuccess(true);
      setError(false);
      setSuccessMsg("Job completed and slip printed successfully");
      
    } catch (error) {
      setError(true);
      setSuccess(false);
      setErrorMsg("An error occurred while processing the job");
    }
  };

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div style={{paddingTop: '20px', paddingLeft: '20px'}}>
            <strong>Assign Item To Worker</strong>
          </div>
          <div className="top-heading-title" style={{display:"flex", flexDirection:"column"}}>
            {/* <div style={{display: 'inline-flex'}}>
            <div className="searchinput-inner" >
              <p>Start Date</p>
              <input type="date" className="searchinput" onChange={(e) => setStartDate(e.target.value)}/>
            </div>
            <div className="searchinput-inner" >
              <p>End Date</p>
              <input type="date" className="searchinput" onChange={(e) => setEndDate(e.target.value)}/>
            </div>
            </div> */}
            <div style={{display: 'inline-flex'}}>
            <div className="searchinput-inner">
              <p>Worker Name</p>
              <select
                name="workername"
                id="retailer"
                value={tailor && tailor._id ? tailor._id : ""}
                onChange={searchSelectChange}
                className="searchinput"
              >
                <option value="">Select Tailor</option>
                {tailors.length > 0 && tailors !== null ? (
                  tailors.map((data, i) => (
                    <option
                      style={{ textTransform: "capitalize" }}
                      key={i}
                      value={data._id}
                    >
                      {data.firstname + " " + data.lastname + " " + data['thai_fullname']}
                    </option>
                    
                  ))
                ) : (
                  <></>
                )}
              </select>
              {/* <span style={{marginLeft: "10px"}}> */}
              {/* <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button> */}
              {/* </span> */}
            </div>
            {showQRInput
            ?
            <div className="searchinput-inner">
              <p>QR Code</p>
              <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                <input 
                  type="text" 
                  className="searchinput" 
                  value={qrCode} 
                  onChange={(e) => setQrCode(e.target.value)}
                  placeholder="Enter QR code or scan with camera"
                />
                <button 
                  type="button"
                  className="custom-btn" 
                  onClick={toggleCamera}
                  style={{
                    padding: '10px 15px',
                    backgroundColor: showCamera ? '#ff4444' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                  title={showCamera ? "Close Camera" : "Open Camera Scanner"}
                >
                  {showCamera ? (
                    <i className="fa-solid fa-times"></i>
                  ) : (
                    <i className="fa-solid fa-camera"></i>
                  )}
                </button>
                {qrCode && (
                  <button 
                    type="button"
                    className="custom-btn" 
                    onClick={clearQrCode}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Clear QR Code"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                )}
              </div>
              
              {/* Camera Scanner View */}
              {showCamera && (
                <div style={{
                  marginTop: '15px',
                  padding: '20px',
                  border: '2px solid #007bff',
                  borderRadius: '10px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <strong>QR Code Scanner</strong>
                    <p style={{margin: '5px 0', fontSize: '14px', color: '#666'}}>
                      Position QR code within the camera view
                    </p>
                    {isScanning && (
                      <p style={{margin: '5px 0', fontSize: '12px', color: '#007bff'}}>
                        <i className="fa-solid fa-spinner fa-spin" style={{marginRight: '5px'}}></i>
                        Scanning for QR codes...
                      </p>
                    )}
                  </div>
                  
                  {cameraError ? (
                    <div style={{
                      textAlign: 'center',
                      color: '#dc3545',
                      padding: '20px',
                      backgroundColor: '#f8d7da',
                      borderRadius: '5px',
                      marginBottom: '15px'
                    }}>
                      <i className="fa-solid fa-exclamation-triangle" style={{marginRight: '10px'}}></i>
                      {cameraError}
                      <br />
                      <div style={{marginTop: '15px'}}>
                        <strong>How to fix:</strong>
                        <ol style={{textAlign: 'left', margin: '10px 0', paddingLeft: '20px'}}>
                          <li>Tap the camera icon in your browser's address bar</li>
                          <li>Select "Allow" for camera access</li>
                          <li>Refresh the page if needed</li>
                          <li>Try again using the button below</li>
                        </ol>
                      </div>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '15px'}}>
                        <button 
                          onClick={requestCameraPermission}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Request Camera Permission
                        </button>
                        <button 
                          onClick={tryAlternativeScanner}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#ffc107',
                            color: 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Try Alternative Scanner
                        </button>
                        <button 
                          onClick={toggleCamera}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: '15px'
                    }}>
                      {useAlternativeScanner ? (
                        <div 
                          id="qr-reader" 
                          style={{
                            width: '100%',
                            maxWidth: '350px'
                          }}
                        ></div>
                      ) : (
                        <video
                          ref={videoRef}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            height: '300px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            backgroundColor: '#000'
                          }}
                          playsInline
                          muted
                        />
                      )}
                    </div>
                  )}
                  
                  <div style={{textAlign: 'center'}}>
                    <button 
                      className="btn-history2" 
                      onClick={stopScanner}
                      style={{marginRight: '10px'}}
                    >
                      Close Camera
                    </button>
                  </div>
                </div>
              )}
              
              <button className="btn-history2" onClick={handleAssignItem} style={{marginTop: '10px'}}>
                Assign
              </button>
            </div>
            :
            <></>
            }
            </div>
          </div>

            {showJob
            ?

            jobs.map((job) =>{
              let costTotal = 0;
              let type = "Normal"
              if(job['extraPayments'].length > 0){
                type = "Both"
                for(let x of job['extraPayments']){
                  if(x['approved'] == true && x['status'] !== false){
                    costTotal = costTotal + x['cost']
                  }
                }
              }
              if(job['stylingprice'] && Object.keys(job['stylingprice']).length > 0){
                type = "Both"
                for(const price of Object.values(job['stylingprice'])){
                  costTotal = costTotal + Number(price)
                }
              }

              const code = job['item_code'].split("/")[1].split("_")[0]
              let itemName = "";
              if(code === 'suit'){
                itemName = job['item_code'].split("/")[1].split("_")[1] + " " + Number(job['item_code'].split("/")[1].split("_")[2]) + 1
              }else if(code === 'tuxedo'){
                itemName = job['item_code'].split("/")[1].split("_")[1] + " " + Number(job['item_code'].split("/")[1].split("_")[2]) + 1
              }else{
                itemName = code + " " + Number(job['item_code'].split("/")[1].split("_")[1]) + 1
              }

              // Get selected extra payment categories details
              const selectedExtraPayments = extraPaymentCategories.filter(epc => 
                checkboxItem.includes(epc['_id'])
              );

              return(
                <div className="job-card-container" style={{width:"calc(100% - 40px)",marginLeft:"20px",marginBottom:"20px",borderRadius:"5px!important",color: "#000",border:"1px solid #e1e1e1", backgroundColor: "rgb(28 77 143 / 8%)",borderRadius:"10px",boxShadow:"px 6px 16px rgba(00,00,00,0.09)", display:"flex", flexDirection: "row", padding:"15px",borderLeft:"5px solid #1c4d8f"}}>
                {/* sfdsfs */}
                <div className="job-card-left" style={{width:"65%",}}>
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Item: <span style={{marginLeft:"auto",fontWeight:"700", textTransform: "capitalize"}}>{itemName}</span></p>
                  
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}}  >Description: <span style={{marginLeft:"auto",fontWeight:"700", textTransform: "capitalize"}}>{job['process']['description']}</span></p>
                    
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}}  >Type: <span style={{marginLeft:"auto",fontWeight:"700"}}>{type}</span></p>
                  
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Date:  <span style={{marginLeft:"auto",fontWeight:"700"}}>{new Date(job['date']).toLocaleDateString()}</span></p>
                
                </div>
                
                <div className="job-card-right" style={{width:"30%",marginLeft:"auto",padding:"20px 16px",textAlign:"left",backgroundColor:"#fff",borderRadius:"10px",boxShadow:"0px 6px 18px rgba(00,00,00,0.09)"}}>
                  
                  <p style={{fontSize:"24px",fontWeight:"700",color:"#000", margin:"0"}}>{job['order_id'] ? job['order_id']['orderId'] : job['group_order_id']['orderId']}</p>
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Amount: <span style={{marginLeft:"auto",fontWeight:"700"}}>{job['cost']}</span></p>
                  
                  {/* Extra Payments Breakdown */}
                  {(job['extraPayments'].length > 0 || selectedExtraPayments.length > 0 || (job['stylingprice'] && Object.keys(job['stylingprice']).length > 0) ) && (
                    <div style={{marginBottom:"10px"}}>
                      <p style={{fontSize:"14px",fontWeight:"600",color:"#1c4d8f",marginBottom:"5px",borderBottom:"1px solid #e1e1e1",paddingBottom:"5px"}}>Extra Payments:</p>
                      
                      {/* Existing Extra Payments */}
                      {job['extraPayments'].map((extraPayment, index) => {
                        if(extraPayment['approved'] == true && extraPayment['status'] !== false){
                          return (
                            <div key={index} style={{fontSize:"13px",fontWeight:"500",display:"flex",width:"100%",paddingBottom:"8px",paddingTop:"4px",backgroundColor:"rgba(0, 0, 0, 0.02)",padding:"6px 8px",borderRadius:"4px",marginBottom:"4px"}}>
                              <span style={{fontWeight:"600"}}>{extraPayment['name'] || 'Extra Payment'}</span>
                              <span style={{marginLeft:"auto",fontWeight:"700"}}>THB {extraPayment['cost']}</span>
                            </div>
                          )
                        }
                        return null;
                      })}
                      
                      {/* Styling Prices */}
                      {job['stylingprice'] && Object.entries(job['stylingprice']).map(([style, price], index) => {
                        if (Number(price) > 0) {
                          return (
                            <div key={`styling-${index}`} style={{fontSize:"13px",fontWeight:"500",display:"flex",width:"100%",paddingBottom:"8px",paddingTop:"4px",backgroundColor:"rgba(0, 0, 0, 0.02)",padding:"6px 8px",borderRadius:"4px",marginBottom:"4px"}}>
                              <span style={{fontWeight:"600", textTransform: "capitalize"}}>{style.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span style={{marginLeft:"auto",fontWeight:"700"}}>THB {price}</span>
                            </div>
                          )
                        }
                        return null;
                      })}
                      
                      {/* Newly Selected Extra Payments */}
                      {selectedExtraPayments.map((extraPayment, index) => (
                        <div key={`new-${index}`} style={{fontSize:"13px",fontWeight:"500",display:"flex",width:"100%",paddingBottom:"8px",paddingTop:"4px",color:"#1c4d8f",backgroundColor:"rgba(28, 77, 143, 0.05)",padding:"6px 8px",borderRadius:"4px",marginBottom:"4px"}}>
                          <span style={{fontWeight:"600"}}>{extraPayment['name']} {extraPayment['thai_name'] && `/ ${extraPayment['thai_name']}`}</span>
                          <span style={{marginLeft:"auto",fontWeight:"700"}}>THB {extraPayment['cost']}</span>
                        </div>
                      ))}
                      
                      {/* Total Amount */}
                      <div style={{fontSize:"15px",fontWeight:"700",display:"flex",width:"100%",borderTop:"2px solid #1c4d8f",paddingTop:"10px",paddingBottom:"6px",color:"#1c4d8f",marginTop:"8px"}}>
                        <span style={{fontWeight:"700"}}>Total Amount:</span>
                        <span style={{marginLeft:"auto",fontWeight:"800"}}>THB {job['cost'] + costTotal + extraPaymentCategoriesSelectedCost}</span>
                      </div>
                    </div>
                  )}
                  
                  <div style={{display: "flex", flexWrap: "wrap", gap: "8px", flexDirection: "column"}}>
                    <button 
                      onClick={() => handlePrintSlipWithCompletion(job)} 
                      className="custom-btn" 
                      style={{backgroundColor:"#1CDF8A !important",fontSize:"14px",fontWeight:"400",color:"#fff", border:"none", marginBottom: "8px"}}
                    >
                      Print Slip & Complete Job
                    </button>
                    {/* {job['process']['name'].includes('stitching') && ( */}
                      <button 
                        onClick={handleOpenExtraPaymentCategories} 
                        className="custom-btn-white" 
                      >
                        Create Extra Payment
                      </button>
                     {/* )} */}
                  </div>
                </div>
              </div>
              )
            })
            :
            <></>
         
          }

          {showUnfinishedJobs
            ?
            <div className="table-responsive">
            <table className="table">
            <thead>
              <tr>
                <th>Tailor</th>
                <th>Item</th>
                <th>Order</th>
                <th>Description</th>
                <th>Type</th>
                <th>Cost</th>
                {/* <th><input type="checkbox" onClick={handleCheckAllJobs}/>Check All</th> */}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {
              unfinishedJobs.map((singleUnfinishedJob) => {
                let costTotal = singleUnfinishedJob.cost
                let type = "Normal"
                
                if(singleUnfinishedJob['extraPayments'].length > 0){
                  type = "Both";
                  for(let x of singleUnfinishedJob['extraPayments']){
                    if(x['approved'] == true && x['status'] !== false){
                      costTotal = costTotal + Number(x['cost'])
                    }
                  }
                }
                if(singleUnfinishedJob['stylingprice']){
                  let stylingNum = 0;
                  for(let x of Object.values(singleUnfinishedJob['stylingprice'])){
                    stylingNum = stylingNum + Number(x)
                  }
                  costTotal = costTotal + stylingNum
                }
                return (
                  <tr key={singleUnfinishedJob['_id']}>
                    <td>
                      <span >{singleUnfinishedJob.tailor.firstname + " " + singleUnfinishedJob.tailor.lastname}</span>
                      
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[0] == 'suit'
                        ?
                        Number(singleUnfinishedJob.item_code.split("/")[1].split("_")[2]) +
                        1 +
                        " " +
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[1]
                        + 
                        " ("
                        +
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[0]
                        +
                        ")"
                        :
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[0] == 'tuxedo'
                        ?
                        Number(singleUnfinishedJob.item_code.split("/")[1].split("_")[2]) +
                        1 +
                        " " +
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[1]
                        + 
                        " ("
                        +
                        singleUnfinishedJob.item_code.split("/")[1].split("_")[0]
                        +
                        ")"
                        :
                        Number(singleUnfinishedJob.item_code.split("/")[1].split("_")[1]) +
                          1 +
                          " " +
                          singleUnfinishedJob.item_code.split("/")[1].split("_")[0]
                      }
                    </td>
                    <td>{singleUnfinishedJob.order_id ? singleUnfinishedJob.order_id.orderId : singleUnfinishedJob.group_order_id.orderId}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {singleUnfinishedJob.process["name"]}
                    </td>
                    <td>{type}</td>
                    <td>{costTotal}</td>
                    <td>
                    <button 
                      onClick={(e) => handlePrintSlipWithCompletion(singleUnfinishedJob, singleUnfinishedJob['_id'])} 
                      className="custom-btn-new"
                    >
                      Print Slip & Finish
                    </button>
                    </td>
                  </tr>
                );
              })
              }
            </tbody>
          </table>
          </div>
            :
              <></>
          }
        </div>
      </div>
      <Dialog
        open={open2}
        onClose={handleClose2}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose2}>Cancel</Button>
          {/* <Button onClick={handleDelete} autoFocus>
                    Yes
                    </Button> */}
        </DialogActions>
      </Dialog>
      <Dialog
        open={showExtraPaymentCategories}
        onClose={() => setShowExtraPaymentCategories(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" style={{fontFamily: "inherit", color: "#1C4D8F"}}>{"Add Extra Payment?"}</DialogTitle>
                  <div style={{display: "flex", flexDirection: "column"}}>
                    {extraPaymentCategories.length > 0 && showJob
                    ?
                    extraPaymentCategories.map((epc) =>{
                      console.log("epc ", epc)
                    const code = jobs[0]['item_code'].split("/")[1]
                    let itemName = "";
                    if(code.split("_")[0] === "suit"){
                      itemName = code.split("_")[1]
                    }else if(code.split("_")[0] === "tuxedo"){
                      itemName = code.split("_")[1]
                    }else{
                      itemName = code.split("_")[0]
                    }
                    if(itemName == epc['product']['name'] && epc['process']?.['_id'] == jobs[0]['process']['_id']){
                      return(
                        <div className="extra-payment-item" style={{padding: "20px 10px", fontSize: "16px", fontWeight: "500", backgroundColor: "#EDF1F6", marginBottom: "5px", borderRadius:"5px"}}>
                          <label className="full_label">
                            <input type="checkbox" id={epc['_id']} value={epc['_id']} checked={checkboxItem.includes(epc['_id'])} onChange={(e) => handleCheckboxChange(e, epc['cost'])}/>
                            <span style={{paddingLeft: "10px"}}> <label htmlFor={epc['_id']}>{epc['name']} / {epc['thai_name']} - THB {epc['cost']}</label> </span>                           
                          </label>
                        </div>
                      )
                    }
                     
                    })
                  :
                  <></>}
                  </div>
        <DialogActions>
          <button className="custom-btn-white" onClick={() => setShowExtraPaymentCategories(false)}>Cancel</button>
          <button className="custom-btn" onClick={() => handleCreateExtraPayment()}>Create</button>
        </DialogActions>
      </Dialog>

      {success && (
        <Snackbar open={success} autoHideDuration={2000} onClose={handleClose}>
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
        <Snackbar open={error} autoHideDuration={2000} onClose={handleClose}>
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}