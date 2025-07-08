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

export default function AddWorkAdvancePayment() {
  const { user } = useContext(Context);
  const [tailors, setTailors] = useState([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [tailor, setTailor] = useState("");
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);

  const fetchTailors = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", {
      token: user.data.token,
    });
    setTailors(res.data.data);
  };
  useEffect(() => {
    fetchTailors();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const advancePayment = {
      workerAdvancePayment: {
        worker:tailor,
        title:title,
        amount:amount
      },
      token: user.data.token,
    };
    if (tailor == "" || title == "" || amount == "") {
      setOpen(true);
      setError(true);
      setErrorMsg("Please fill this input!");
    } else {
      const res = await axiosInstance.post("/workerAdvancePayment/create", advancePayment);
      if (res.data.status == true) {
        setOpen(true);
        setSuccess(true);
        setTailor("");
        setTitle("");
        setAmount("");
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

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table managemeasurement-page">
          <div className="top-heading-title">
            <strong>Worker Advance Payment</strong>
          </div>
          <div className="searchstyle searchstyle-one">
            <div className="searchinput-inner">
              <p>Worker Name</p>
              <select
                className="searchinput"
                value={tailor}
                onChange={(e) => setTailor(e.target.value)}
              >
                <option value="all">Select Tailor</option>
                {tailors.length > 0 && tailors !== null ? (
                  tailors.map((tailor, i) => (
                    <option
                      key={i}
                      value={tailor._id}
                    >{tailor.firstname + " " + tailor.lastname + " " + tailor['thai_fullname']}</option>
                  ))
                ) : (
                  <></>
                )}
              </select>
            </div>
            <div className="searchinput-inner">
              <p>Advance Title</p>
              <input
                type="text"
                className="searchinput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="searchinput-inner">
              <p>Advance Amount</p>
              <input
                type="text"
                className="searchinput"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                className="custom-btn"
                onClick={handleSubmit}
              >
                Submit
              </button>
            </div>
            <div className="searchinput-inner">
              <Link to="/factory/advancepaymenthistory" className="btn-history2">
                Check Payment History
              </Link>
            </div>
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
            Worker Advance Payment created successfully.
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
