import React from "react";
import Divider from '@mui/material/Divider';
import "./factory.css";
import { Link } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import { renderToString } from "react-dom/server";
import jsPDF from 'jspdf';
import Logo from '../../../../images/logo.png';
import Button from "@mui/material/Button";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function WorkPaymentHistory() {


  const { user } = useContext(Context);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const [tailors, setTailors] = useState([]);
  const [tailor, setTailor] = useState({});
  const [payments, setPayments] = useState([]);
  const [showWorkerPaymentHistory, setShowWorkerPaymentHistory] = useState(false)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchTailors();
  }, []);

  const searchSelectChange = (e) => {
    const tailorObject = tailors.filter((data) => data._id == e.target.value);
    setTailor(tailorObject[0]);
  };
  const handleSearch = () => {
    const obj = {
      tailor: tailor['_id']
    };
    if (startDate.length > 0) {
      obj['startDate'] = startDate
    }
    if (endDate.length > 0) {
      obj['endDate'] = startDate
    }

    fetchWorkerPaymentHistory(obj)
  }


  // ======================================================================
  // ========================== static function ===========================
  // ======================================================================

  const fetchTailors = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", {
      token: user.data.token,
    });
    setTailors(res.data.data);
  };

  const fetchWorkerPaymentHistory = async (par = null) => {
    const res = await axiosInstance.post("/payments/fetchAll", { token: user.data.token, par: par })
    if (res.data.status == true) {
      if (startDate.length > 0 && !endDate.length > 0) {
        const paymentsArray = res.data.data.filter((payment) => payment.date > new Date(startDate).getTime())
        setPayments(paymentsArray)
        setShowWorkerPaymentHistory(true);
        setError(false)
        setSuccess(true)
        setSuccessMsg(res.data.message)
      }
      if (!startDate.length > 0 && endDate.length > 0) {
        const paymentsArray = res.data.data.filter((payment) => payment.date < new Date(endDate).getTime())
        setPayments(paymentsArray)
        setShowWorkerPaymentHistory(true);
        setError(false)
        setSuccess(true)
        setSuccessMsg(res.data.message)
      }
      if (startDate.length > 0 && endDate.length > 0) {
        const paymentsArray = res.data.data.filter((payment) => {
          return new Date(startDate).getTime() < payment.date && payment.date < new Date(endDate).getTime()
        })
        setPayments(paymentsArray)
        setShowWorkerPaymentHistory(true);
        setError(false)
        setSuccess(true)
        setSuccessMsg(res.data.message)
      }
      if (!startDate.length > 0 && !endDate.length > 0) {
        setPayments(res.data.data)
        setShowWorkerPaymentHistory(true);
        setError(false)
        setSuccess(true)
        setSuccessMsg(res.data.message)
      }
    } else {
      setSuccess(false)
      setError(true)
      setErrorMsg(res.data.message)
      setShowWorkerPaymentHistory(false)
      setPayments([])
    }
  }

  const exportPDF = async (e, pid) => {

    const paymentArray = payments.filter((payment) => payment['_id'] == pid)
    console.log("paymentArray: ", paymentArray)

    let htmlElement = (
      <>
        <div style={{ textAlign: 'center', margin: '25px', fontFamily: "Roboto" }}>
          <table style={{ width: '725px' }} cellSpacing={0} cellPadding={2} border={0}>
            <tbody>
              <tr>
                <td colSpan={3} align="left" style={{ borderBottom: '1px solid #ccc' }} valign="middle">
                  <img src={Logo} alt="logo" height="60px" />
                </td>
                <td colSpan={2} align="right" style={{ borderBottom: '1px solid #ccc' }}>
                  <p style={{ lineHeight: '15px', color: '#666', textAlign: 'right' }}>
                    <font style={{ fontSize: '10px', textAlign: 'right' }}>1022/87 Charoen Nakorn 34/2<br />Banglampu-Lang, Bangkok<br />10600 Thailand.</font>
                  </p>
                </td>
              </tr>
              <tr style={{ backgroundColor: "white" }}>
                <td colSpan={3} style={{ textAlign: 'left' }}>
                  <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Worker Name :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px", textTransform: "capitalize" }}>{paymentArray[0]['tailor']['firstname'] + " " + paymentArray[0]['tailor']['lastname']}</span></font>
                </td>
                <td colSpan={2} style={{ textAlign: 'right' }}>
                  <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Invoice Date :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{new Date(paymentArray[0]['date']).toLocaleDateString()}</span></font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#26377D', padding: '10px 20px' }}>
                <th colSpan={2} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>ORDER NO</strong></font>
                </th>
                <th colSpan={2} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>PRODUCTS</strong></font>
                </th>
                <th colSpan={1} style={{ textAlign: 'right', color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>AMOUNT</strong></font>
                </th>
              </tr>

              {paymentArray[0]['job'].length > 0

                ?
                paymentArray[0]['job'].map((job) => {
                  let totalCost = 0;
                  if(job['extraPayments'].length > 0){
                    job['extraPayments'].forEach((extraPayment) => {
                      totalCost += extraPayment['cost']
                    })
                  }
                  totalCost += job['cost']
                  return (
                    <tr style={{ backgroundColor: '#f4f4f4' }} key={job['_id']}>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>{job['item_code'].split("/")[0]}</font>
                      </td>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                          {"1  " + job['item_code'].split("/")[1].split("_")[0]}
                        </font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                        <font style={{ fontSize: '14px' }}>{totalCost}</font>
                      </td>
                    </tr>

                  )
                })
                :
                <></>}
              {paymentArray[0]['extraPaymentCategory'].length > 0

                ?
                paymentArray[0]['extraPaymentCategory'].map((extraPaymentCategory) => {
                  return (
                    <tr style={{ backgroundColor: '#f4f4f4' }} key={extraPaymentCategory['_id']}>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>{extraPaymentCategory['item_code'].split("/")[0]}</font>
                      </td>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                          {"1  " + extraPaymentCategory['item_code'].split("/")[1].split("_")[0]}
                        </font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                        <font style={{ fontSize: '14px' }}>{extraPaymentCategory['cost']}</font>
                      </td>
                    </tr>

                  )
                })
                :
                <></>}
              {/* <tr style={{ backgroundColor: '#f4f4f4' }}>
                  <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                    <font style={{ fontSize: '14px' }}>SSS-0000250</font>
                  </td>
                  <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                    <font style={{ fontSize: '14px' }}>
                        1 Pants 
                    </font>
                  </td>
                  <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                    <font style={{ fontSize: '14px' }}>210</font>
                  </td>
                </tr> */}
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Subtotal</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{paymentArray[0]['subTotal'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Total Advance</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{paymentArray[0]['tailorAdvance'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Deduct Advance</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{paymentArray[0]['deductedAdvance'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Rent</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{paymentArray[0]['rent'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Manual Bill</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{paymentArray[0]['manualBill'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Total Paid</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{paymentArray[0]['totalPay'] + ".00"}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Paid Date</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{new Date(paymentArray[0]['date']).toLocaleDateString()}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: 'white' }}>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  <font style={{ color: '#26377D', fontSize: '15px', fontWeight: '600' }}>Thank You For Shopping At Siam Suits Supply</font>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    )
    let elementAsString = renderToString(htmlElement);
    let doc = new jsPDF('p', 'px', [794, 1123]);
    doc.html(elementAsString, {
      callback: function (doc) {
        window.open(doc.output('bloburl'), '_blank');
      },
      x: 10,
      y: 10,
    });
  }
  // =======================================================================
  // =======================================================================

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Worker Payment History</strong>
          </div>
          <div className="searchstyle searchstyle-one">
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
            </div>
            <div className="searchinput-inner">
              <p>Start Date</p>
              <input type="date" className="searchinput" onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="searchinput-inner">
              <p>End Date</p>
              <input type="date" className="searchinput" onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="searchinput-inner" style={{marginLeft: "15px"}}>
              <button type="button" className="custom-btn" onClick={handleSearch}> <i className="fa-solid fa-search"></i></button>
            </div>
            {/* <div className="searchinput-inner">
                    <p>End Date</p>
                    <input type="date" className="searchinput"/>
                    <button type="button" className="custom-btn"> <i className="fa-solid fa-search"></i></button>
                  </div> */}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>S.NO</th>
                <th>PAID AMOUNT</th>
                <th>PAID DATE</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {showWorkerPaymentHistory
                ?
                payments.map((payment, index) => {
                  return (
                    <tr key={payment['_id']}>
                      <td>Invoice {index + 1}</td>
                      <td>{payment['totalPay']} /-</td>
                      <td>{new Date(payment['date']).toLocaleDateString()}</td>
                      <td><Button data-id={payment['_id']} onClick={(e) => exportPDF(e, payment['_id'])} className="Eyebtn"><RemoveRedEyeIcon /></Button></td>

                    </tr>
                  )
                })
                :
                <></>
              }


            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}