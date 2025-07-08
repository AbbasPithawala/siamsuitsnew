import React, { useState, useEffect, useContext } from "react";
import "./factory.css";
import { Link } from "react-router-dom";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function WorkAdvancePaymentHistory(){

  const { user } = useContext(Context);
  const [tailors, setTailors] = useState([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [tailor, setTailor] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [workerAdvancePayments, setWorkerAdvancePayments] = useState([])
  const [showAdvancePayments, setShowAdvancePayments] =useState(false)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");


  useEffect(() => {
    fetchTailors();
  }, []);
   
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setError(false)
  };

  const handleSelectTailor = (e) => { 
    // setTailor(e.target.value)

    // fetchWorkerAdvancePayments(e.target.value)
  }
console.log(workerAdvancePayments)

 const searchSelectChange = (e) => {
      const tailorObject = tailors.filter((data) => data._id == e.target.value);  
      setTailor(tailorObject[0]);
    };
    const handleSearch = () => {
      const obj = {
        worker: tailor['_id']
      };
      if(startDate.length > 0){
        obj['startDate'] = startDate
      }
      if(endDate.length > 0){
        obj['endDate'] = startDate
      }
      
      fetchWorkerAdvancePayments(obj)
    }

  // ===========================================================
  // ==================static functions=========================

  const fetchTailors = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", {
      token: user.data.token,
    });
    setTailors(res.data.data);
  };

  const fetchWorkerAdvancePayments = async(par = null) => {
    // par['worker'] = tailor
    const res = await axiosInstance.post("/workerAdvancePayment/fetchAll", {
      token: user.data.token,
      par: par
    });
    if(res.data.status == true){

      if(startDate.length > 0 && !endDate.length > 0){  
        const paymentsArray = res.data.data.filter((payment) => payment.date > new Date(startDate).getTime())
       
      setShowAdvancePayments(true)
      setWorkerAdvancePayments(paymentsArray)
      setSuccess(true)
      setSuccessMsg(res.data.message)
      setError(false)
      }
      if(!startDate.length > 0 && endDate.length > 0){
        const paymentsArray = res.data.data.filter((payment) => payment.date < new Date(endDate).getTime())
        
      setShowAdvancePayments(true)
      setWorkerAdvancePayments(paymentsArray)
      setSuccess(true)
      setSuccessMsg(res.data.message)
      setError(false)
      }
      if(startDate.length > 0 && endDate.length > 0){
        const paymentsArray = res.data.data.filter((payment) => {
          return  new Date(startDate).getTime() < payment.date  && payment.date < new Date(endDate).getTime()
        })
  
        setShowAdvancePayments(true)
        setWorkerAdvancePayments(paymentsArray)
        setSuccess(true)
        setSuccessMsg(res.data.message)
        setError(false)
      }
      if(!startDate.length > 0 && !endDate.length > 0){
   
        setShowAdvancePayments(true)
        setWorkerAdvancePayments(res.data.data)
        setSuccess(true)
        setSuccessMsg(res.data.message)
        setError(false)
      }
    }else{
      setShowAdvancePayments(false)      
      setWorkerAdvancePayments([])
      setSuccess(false)
      setErrorMsg(res.data.message)
      setError(true)
    }
  }
  // ===========================================================
  // ===========================================================
    return (
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Worker Advance Payment History</strong>
                </div>
                <div className="searchstyle searchstyle-one">
                <div className="searchinput-inner">
              <p>Worker Name</p>
              <select
                className="searchinput"
                value={tailor['_id']}
                onChange={(e) => searchSelectChange(e)}
              >
                <option value="all">Select Tailor</option>
                {tailors.length > 0 && tailors !== null ? (
                  tailors.map((tailor, i) => (
                    <option
                      key={i}
                      value={tailor._id}
                    >{`${tailor.firstname} ${tailor.lastname}`}</option>
                  ))
                ) : (
                  <></>
                )}
              </select>
            </div>

               <div className="searchinput-inner">
                  <p>Start Date</p>
                  <input type="date" className="searchinput" onChange={(e) => setStartDate(e.target.value)}/>
                </div>
                <div className="searchinput-inner">
                  <p>End Date</p>
                  <input type="date" className="searchinput" onChange={(e) => setEndDate(e.target.value)}/>
                <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button>
                </div>
                  {/* <div className="searchinput-inner">
                    <p>Start Date</p>
                    <input type="date" className="searchinput"/>
                  </div>
                  <div className="searchinput-inner">
                    <p>End Date</p>
                    <input type="date" className="searchinput"/>
                   <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button>
                </div> */}
                  <div className="searchinput-inner">
                    <Link to="/factory/advancepayment" className="btn-history">Add Payment</Link>
                  </div>
                </div>
            </div>
            <div className="order-table manage-page">
            {showAdvancePayments ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Advance Title</th>
                  <th>Advance Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td></td>
                  <td>ยอดค้าง ณ ปจุบัน (current owe)</td>
                  <td>{workerAdvancePayments[0]['worker']['advancePayment']}</td></tr>
                {workerAdvancePayments.map((payment) => {
                  return (
                    <tr>
                      <td>
                        {new Date(payment.date).toLocaleDateString()}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {payment['title']}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                      {payment['amount']}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div>No Payments Found!</div>
          )}
            </div>
            </div>
           

            {success && (
                    <Snackbar
                      open={success}
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
                      open={error}
                      autoHideDuration={2000}
                      onClose={handleClose}
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
        </main>
    )
}