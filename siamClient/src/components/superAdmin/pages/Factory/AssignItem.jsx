import React from "react";
import "./factory.css";
import { Link } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
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
import { renderToString } from "react-dom/server";
import jsPDF from "jspdf";
import Logo from "../../../../images/logo.png";
import mainQR from "../../../../images/PDFQR.png";


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
  const [showUnfinishedJobs, setShowUnfinishedJobs] = useState(false)
  const [extraPaymentCategoriesSelectedCost, setExtraPaymentCategoriesSelectedCost] = useState(0)
  const [showConfirmButton, setShowConfirmButton] = useState(false)
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

  const handleCheckboxChange = async(e, cst) =>{
    if(e.target.checked){
      setCheckboxItem([...checkboxItem, e.target.value])
      let epcsc = extraPaymentCategoriesSelectedCost
      epcsc = epcsc + Number(cst)
      setExtraPaymentCategoriesSelectedCost(epcsc)
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
    setShowConfirmButton(true)

   }

   const handleConfirmJob = () => {

    setJobs([])
    setQrCode("")
    setShowJob(false)
    fetchUnfinishedJobs(tailor['_id'])
  }
   const handleConfirmJob2 = async() => {

    let orderID = ""
    let type = "normal"
    if(jobs[0]['order_id']){
      orderID = jobs[0]['order_id'] 
    }else{
      type = "group"
      orderID = jobs[0]['group_order_id'] 
    }
      const res = await axiosInstance.post("/tailer/createExtraPayment", {
        token: user.data.token,
        tailor: tailor['_id'],
        item: jobs[0]['item_code'],
        type: type,
        order: orderID,
        extraPayments: checkboxItem,
        job: jobs[0]['_id']
      })

      if(res.data.status === true){
        setShowJob(false)
        fetchUnfinishedJobs(tailor['_id'])
        setShowConfirmButton(false)
        setExtraPaymentCategoriesSelectedCost(0)
        setJobs([])
        setCheckboxItem([])
        setTailor({})
        setSuccess(true)
        setError(false)
        setSuccessMsg(res.data.message)
      }else{
        setSuccess(false)
        setError(true)
        setErrorMsg(res.data.message)
      }

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

  const handleFinishJob = async(e, jid) => {
    const par = {
      status: true
    }
    updateJobs(par, jid)
  }


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
                onChange={searchSelectChange}
                className="searchinput"
              >
                <option value=" ">Select Tailor</option>
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
            <input type="text" className="searchinput" value={qrCode} onChange={(e) => setQrCode(e.target.value)}/>
            <button className="btn-history2" onClick={handleAssignItem} >Assign</button>
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

              const code = job['item_code'].split("/")[1].split("_")[0]
              let itemName = "";
              if(code === 'suit'){
                itemName = job['item_code'].split("/")[1].split("_")[1] + " " + Number(job['item_code'].split("/")[1].split("_")[2]) + 1
              }else if(code === 'tuxedo'){
                itemName = job['item_code'].split("/")[1].split("_")[1] + " " + Number(job['item_code'].split("/")[1].split("_")[2]) + 1
              }else{
                itemName = code + " " + Number(job['item_code'].split("/")[1].split("_")[1]) + 1
              }
              return(
                <div style={{width:"calc(100% - 40px)",marginLeft:"20px",marginBottom:"20px",borderRadius:"5px!important",color: "#000",border:"1px solid #e1e1e1", backgroundColor: "rgb(28 77 143 / 8%)",borderRadius:"10px",boxShadow:"px 6px 16px rgba(00,00,00,0.09)", display:"flex", flexDirection: "row", padding:"15px",borderLeft:"5px solid #1c4d8f"}}>
                {/* sfdsfs */}
                <div style={{width:"65%",}}>
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Item: <span style={{marginLeft:"auto",fontWeight:"700", textTransform: "capitalize"}}>{itemName}</span></p>
                  
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}}  >Description: <span style={{marginLeft:"auto",fontWeight:"700", textTransform: "capitalize"}}>{job['process']['description']}</span></p>
                    
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}}  >Type: <span style={{marginLeft:"auto",fontWeight:"700"}}>{type}</span></p>
                  
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Date:  <span style={{marginLeft:"auto",fontWeight:"700"}}>{new Date(job['date']).toLocaleDateString()}</span></p>
                
                </div>
                
                <div style={{width:"30%",marginLeft:"auto",padding:"20px 16px",textAlign:"left",backgroundColor:"#fff",borderRadius:"10px",boxShadow:"0px 6px 18px rgba(00,00,00,0.09)"}}>
                  
                  <p style={{fontSize:"24px",fontWeight:"700",color:"#000", margin:"0"}}>{job['order_id'] ? job['order_id']['orderId'] : job['group_order_id']['orderId']}</p>
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Amount: <span style={{marginLeft:"auto",fontWeight:"700"}}>{job['cost']}</span></p>
                  <p style={{fontSize:"16px",fontWeight:"500",display:"flex",width:"100%",borderBottom:"1px solid #e1e1e1",paddingBottom:"8PX"}} >Extra Amount: <span style={{marginLeft:"auto",fontWeight:"700"}}>{costTotal + extraPaymentCategoriesSelectedCost}</span></p>
                  {
                    job['process']['name'].includes('stitching') && !showConfirmButton 
                      ? 
                      <>
                    <button onClick={handleOpenExtraPaymentCategories} className="custom-btn" style={{fontSize:"14px",fontWeight:"400",color:"#1c4d8f", border:"none", marginRight: "10px"}} >Create Extra Payment</button>
                    <button onClick={handleConfirmJob2} className="custom-btn" style={{fontSize:"14px",fontWeight:"400",color:"#1c4d8f", border:"none"}} >Finish</button>
                    </>
                      :
                      job['process']['name'].includes('stitching') && showConfirmButton
                      ?
                      <button onClick={handleConfirmJob2} className="custom-btn" style={{fontSize:"14px",fontWeight:"400",color:"#1c4d8f", border:"none"}} >Finish</button>
                      :
                    <button onClick={handleConfirmJob} className="custom-btn" style={{fontSize:"14px",fontWeight:"400",color:"#1c4d8f", border:"none"}} >Finish</button>
                  }
                </div>
              </div>
              )
            })
            :
            <></>
         
          }

          {showUnfinishedJobs
            ?
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
                    <button data-type="job" data-jobid={singleUnfinishedJob['_id']} onClick={(e) => handleFinishJob(e, singleUnfinishedJob['_id'])} className="custom-btn-new" >Finish</button>
                    </td>
                  </tr>
                );
              })
              }
            </tbody>
          </table>
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
                    const code = jobs[0]['item_code'].split("/")[1]
                    let itemName = "";
                    if(code.split("_")[0] === "suit"){
                      itemName = code.split("_")[1]
                    }else if(code.split("_")[0] === "tuxedo"){
                      itemName = code.split("_")[1]
                    }else{
                      itemName = code.split("_")[0]
                    }
                    if(itemName == epc['product']['name']){
                      return(
                        <div style={{padding: "20px 10px", fontSize: "16px", fontWeight: "500", backgroundColor: "#EDF1F6", marginBottom: "5px", borderRadius:"5px"}}>
                          <label className="full_label">
                            <input type="checkbox" id={epc['_id']} value={epc['_id']} onChange={(e) => handleCheckboxChange(e, epc['cost'])}/>
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
          <Button className="custom-btn" onClick={() => setShowExtraPaymentCategories(false)}>Cancel</Button>
          <Button className="custom-btn" onClick={() => handleCreateExtraPayment()}>Create</Button>
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