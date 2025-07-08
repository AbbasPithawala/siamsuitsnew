import React from "react";
import Divider from '@mui/material/Divider';
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

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageExtraPayments(){
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const [workerExtraPayment, setWorkerExtraPayment] = useState({})
  const [workerExtraPayments, setWorkerExtraPayments] = useState([])
  const [showWorkerExtraPayments, setShowWorkerExtraPayments] = useState(false)
  const [approveDailog, setApproveDailog] = useState(false)  
  const [declineDailog, setDeclineDailog] = useState(false)
  const [tailors, setTailors] = useState([]);
  const [tailor, setTailor] = useState({});
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [epCost, setEPCost] = useState(0)
  const [inputAuthorizedBy, setInputAuthorizedBy] = useState(false);
  const [inputCost, setInputCost] = useState(false);
  const [ data , setData] = useState();
  const { user } = useContext(Context);
  // -------------------- bulk selection state --------------------
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
 
  useEffect(() => {
    fetchTailors();

    const obj = {
      status: true,
      approved: false
    }

    fetchExtraPayments(obj);
  }, []);

  const searchSelectChange = (e) => {
    const tailorObject = tailors.filter((data) => data._id == e.target.value);

    const obj = {
      tailor: e.target.value,
      approved: false,
      status: true
    };

    fetchExtraPayments(obj)

    setTailor(tailorObject[0]);
  };

  
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSuccess(false);
    setError(false);
  };

  const handleApproveDailog = (e) => {
    setApproveDailog(true)
    const paymentObject = workerExtraPayments.filter((single) => single._id == e.target.dataset.id) 
    setWorkerExtraPayment(paymentObject[0])
  }

  const handleCloseApproveDailog = () => {
    setApproveDailog(false)
  }

  const handleDeclineDailog = (e) => {
    console.log("sadbakjsdka")
    setDeclineDailog(true)
    const paymentObject = workerExtraPayments.filter((single) => single._id == e.target.dataset.id) 
    setWorkerExtraPayment(paymentObject[0])
  }
  const handleCloseDeclineDailog = () =>{
    setDeclineDailog(false)
  }

  const handleApprovePayment = () => {
    const obj = {
      approved: true
    }
    updateWorkerExtraPayment(obj)
  }

  const handleDeclinePayment = () => {
    const obj = {
      status: false
    }
    updateWorkerExtraPayment(obj)
  }
  
  const handleOpenInputAuthorizedBy = (e) => {
    const paymentArray = workerExtraPayments.filter((single) => single['_id'] == e.target.dataset.id)
    setWorkerExtraPayment(paymentArray[0])
    setInputAuthorizedBy(true)
  }

  const handleOpenInputCost = (e) => {
    const paymentArray = workerExtraPayments.filter((single) => single['_id'] == e.target.dataset.id)
    setWorkerExtraPayment(paymentArray[0])
    setInputCost(true)
  }
  const handleCloseInputCost = () => {
    setInputCost(false)
  }
  const handleCloseInputAuthorizedBy = () => {
    setInputAuthorizedBy(false)
  }

  const handleAddAuthorizedBy = () => {

    const obj = {
      authorizedBy: authorizedBy
    }

    updateWorkerExtraPayment(obj)
    handleCloseInputAuthorizedBy()
  }

  const handleUpdatedCost = () => {
    const obj = {
      cost: epCost
    }

    updateWorkerExtraPayment(obj)
    handleCloseInputCost()
  }

  // ============================= BULK ACTIONS LOGIC =============================
  const handleSelectRow = (id) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAllChecked) {
      setSelectedPaymentIds([]);
    } else {
      const ids = workerExtraPayments.map((p) => p._id);
      setSelectedPaymentIds(ids);
    }
    setSelectAllChecked(!selectAllChecked);
  };

  useEffect(() => {
    const allIds = workerExtraPayments.map((p) => p._id);
    setSelectAllChecked(
      allIds.length > 0 && allIds.every((id) => selectedPaymentIds.includes(id))
    );
  }, [selectedPaymentIds, workerExtraPayments]);

  const bulkUpdatePayments = async (ids, data) => {
    try {
      await Promise.all(
        ids.map((id) =>
          axiosInstance.put("/workerExtraPayments/update/" + id, {
            token: user.data.token,
            extraPayment: data,
          })
        )
      );
      setError(false);
      setSuccess(true);
      setSuccessMsg("Payments updated successfully");

      const obj = { approved: false, status: true };
      if (tailor['_id']) obj['tailor'] = tailor['_id'];
      fetchExtraPayments(obj);
      setSelectedPaymentIds([]);
    } catch (err) {
      setSuccess(false);
      setError(true);
      setErrorMsg("Failed to update selected payments");
    }
  };

  const handleBulkApprove = () => bulkUpdatePayments(selectedPaymentIds, { approved: true });
  const handleBulkDecline = () => bulkUpdatePayments(selectedPaymentIds, { status: false });

    // ======================================================================
  // ========================== static function ===========================
  // ======================================================================

  // const fetchJobs = async (par = null) => {
  //   par['paid'] = false
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

  const fetchExtraPayments = async(par = null) =>{

    const res = await axiosInstance.post("/workerExtraPayments/fetchAll", {
      token: user.data.token,
      filter: par
    });

    console.log(res)
    if(res.data.status == true){
      setWorkerExtraPayments(res.data.data)
      setError(false)
      setSuccess(true)
      setSuccessMsg(res.data.message)
      setShowWorkerExtraPayments(true)
    }else{
      setSuccess(false)
      setError(true)
      setErrorMsg(res.data.message)
      setShowWorkerExtraPayments(false)
    }
    
  }

  const fetchTailors = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", {
      token: user.data.token,
    });
    setTailors(res.data.data);
  };

  const updateWorkerExtraPayment = async(data) => {
    const res = await axiosInstance.put("/workerExtraPayments/update/" + workerExtraPayment['_id'], {token : user.data.token, extraPayment: data})
    
    if(res.data.status == true){

      setError(false)
      setSuccess(true)
      setSuccessMsg(res.data.message)
      handleCloseApproveDailog()
      handleCloseDeclineDailog()
      
      const obj = {
        approved: false,
        status: true
      };
      if(tailor['_id']){
        obj['tailor'] = tailor['_id']
      }
      fetchExtraPayments(obj)
    }else{
      setSuccess(false)
      setError(true)
      setErrorMsg(res.data.message)
      handleCloseApproveDailog()
      handleCloseDeclineDailog()
      
      const obj = {
        tailor: tailor['_id'],
        approved: false,
        status: true
      };

      fetchExtraPayments(obj)
    }
  }

    return (
      <>
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Extra Payments Approval</strong>
                </div>
                <div className="searchstyle searchstyle-one">
                  {/* <div className="searchinput-inner">
                    <p>Barcode id</p>
                    <input type="text" className='searchinput' placeholder="123456 "/>
                  </div> */}
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

             {selectedPaymentIds.length > 0 && (
               <div className="bulk-actions" style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                 <Button className="approve-button" onClick={handleBulkApprove}>
                   Approve Selected
                 </Button>
                 <Button className="decline-button" onClick={handleBulkDecline}>
                   Decline Selected
                 </Button>
               </div>
             )}

                </div>
                {/* <div className="devider-boxNM"> <Divider>PAYMENT CATEGORY</Divider> </div>
                <div className="searchstyle searchstyle-one">
            
                </div> */}
            </div> 
            </div>

        <div className="content-wrapper mt-3 add_order-class">
         <div className="order-table">
       
          <table className="table">
          <thead>
              <tr>
              <th><input type="checkbox" checked={selectAllChecked} onChange={handleSelectAll} /></th>
              <th> Tailor Name</th>
              <th> Order #</th>
              <th> Cost </th>
              <th> Item </th>
              <th> Date </th>
              <th> Authorized by </th>
              <th> Options </th>
              </tr>
          </thead>
          <tbody>
            {showWorkerExtraPayments
            ?
            workerExtraPayments.map((payment) => {
              console.log("payment: ", payment)
              return(
                <tr key={payment._id}>
                <td><input type="checkbox" checked={selectedPaymentIds.includes(payment._id)} onChange={() => handleSelectRow(payment._id)} /></td>
                <td><strong>{payment['tailor']['firstname'] + " " + payment['tailor']['lastname']}</strong> </td>
                <td>{payment['order_id'] ? payment['order_id']['orderId'] : payment['group_order_id']['orderId']}</td>
                <td data-id={payment['_id']} onClick={handleOpenInputCost}> {payment['cost']} </td>   
                <td> {payment['extraPaymentCategory']['name']} </td>             
                <td> {new Date(payment['date']).toLocaleDateString()} </td>
                <td data-id={payment['_id']} onClick={handleOpenInputAuthorizedBy}> {!payment['authorizedBy'] || !payment['authorizedBy'].length > 0 ? "N/A" : payment['authorizedBy']} </td>
                <td><Button data-id={payment._id} onClick = {handleApproveDailog} className="approve-button"> Approve </Button> <Button data-id={payment._id} onClick = {handleDeclineDailog} className="decline-button"> Decline </Button> </td> 
                </tr>
              )
            })
          :
          <></>}
           
              {/* <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
                </tr>
                <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
                </tr>
                <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
                </tr>
                <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
                </tr>
                <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
                </tr>
                <tr>
                <td><strong> John Doe </strong> </td>
                <td>BTP-03568 </td>
                <td> 11550 </td>
                <td>Tishrt</td>
                <td> Nathalie </td>
                <td> <Button className="edit-button"> Edit </Button> <Button className="approve-button"> Approve </Button> <Button className="decline-button"> Decline </Button> </td> 
              </tr> */}
          </tbody>
          </table>
         
      </div>
     </div>
     {/* moved bulk-actions to top search area */}
     <Dialog
        open={approveDailog}
        onClose={handleCloseApproveDailog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to Approve this payment?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApproveDailog}>Cancel</Button>
          <Button onClick={handleApprovePayment} autoFocus>
                    Yes
                    </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={declineDailog}
        onClose={handleCloseDeclineDailog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to Decline this payment?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeclineDailog}>Cancel</Button>
          <Button onClick={handleDeclinePayment} autoFocus>
                    Yes
                    </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inputAuthorizedBy}
        onClose={handleCloseInputAuthorizedBy}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <input type="text" onChange={(e) => setAuthorizedBy(e.target.value)}/>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInputAuthorizedBy}>Cancel</Button>
          <Button onClick={handleAddAuthorizedBy} autoFocus>
                    Add
                    </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inputCost}
        onClose={handleCloseInputCost}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <input type="text" onChange={(e) => setEPCost(Number(e.target.value))}/>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInputCost}>Cancel</Button>
          <Button onClick={handleUpdatedCost} autoFocus>
                    Add
                    </Button>
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
      </>
    )
}