import React, { useState, useContext, useEffect } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useLocation, useNavigate } from "react-router-dom";
import validator from "validator";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageRoleFormEdit(){
  const location = useLocation()
  const navigate = useNavigate()
  const id = location.pathname.split('/')[3]
  const [role, setRole] = useState('')
  const [checkboxItem, setCheckboxItem] = useState([])
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState({
    role:false,
  })

  const getData = {
    id:id,
    token:user.data.token
  }

 useEffect(() => {
  const fetchRole = async () =>{
      const res = await axiosInstance.post('/roles/fetch', getData)
      setRole(res.data.data[0].role_name)
      setCheckboxItem(res.data.data[0].modules)
  }
  fetchRole()
 },[])

 const handleCheckboxChange = async(e) =>{
  if(e.target.checked){
    setCheckboxItem([...checkboxItem, e.target.value])
  }else{
    const updatedSelectedItem = checkboxItem.filter(
      (selectedItem) => selectedItem !== e.target.value
    );
    setCheckboxItem(updatedSelectedItem);
  }
   
 }

 const handleSubmit = async(e) => {
  e.preventDefault()
  const newRole = {
    role:{
      role_name:role,
      modules:checkboxItem
    },
    token:user.data.token
  }

  if(validator.isEmpty(role)){
    setValidationError({role: role.length === 0})
    setOpen(true)
    setError(true)
    setErrorMsg("Please fill this input!")
  }else{
      try {
          const res = await axiosInstance.put("/roles/updateRole", newRole)
          setOpen(true)
          setSuccess(true)
          setTimeout(() => {
            navigate(`/admin/roles`);
          }, 1000);
       }catch{
   
       }
  }
  
 }

 const handleClose = (event, reason) => {
  if (reason === "clickaway") {
    return;
  }

  setSuccess(false);
  setOpen(false)
  setError(false)
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

  return(
    <main className="main-panel">
     <div className="content-wrapper">
       <div className="top-heading-title">
        <strong>Edit Role </strong>
     </div>

    <div className="admin-from-style-NM">
       <form onSubmit = {handleSubmit}>
        <div className={validationError.role ? "form-group error-handle" : "form-group"}>
          <label>Role Name <span className="red-required">*</span></label>
          <input className="searchinput" type="text" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
      <div className="form-group row">
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="role_block">
            <h4>Admin Module</h4>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID1" value="Manage Roles" checked={ checkboxItem.includes("Manage Roles") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID1">Manage Roles</label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkFactoryModuleID2" value="Manage User Login" checked={ checkboxItem.includes("Manage User Login") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkFactoryModuleID2">Manage User Login</label> 
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID2" value="Manage Products" checked={ checkboxItem.includes("Manage Products") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID2">Manage Products </label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID3" value="Manage Retailers" checked={ checkboxItem.includes("Manage Retailers") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID3">Manage Retailers</label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID4" value="Manage Measurements" checked={ checkboxItem.includes("Manage Measurements") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID4">Manage Measurements</label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID6" value="Manage Styling Options" checked={ checkboxItem.includes("Manage Styling Options") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID6">Manage Styling Options</label>
            </label>
            <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID661" value="Manage Group Styling" checked={ checkboxItem.includes("Manage Group Styling") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID661">Manage Group Styling</label>
             </label>
           <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID61" value="Manage Retailer Styling" checked={ checkboxItem.includes("Manage Retailer Styling") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID61">Manage Retailer Styling</label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID7" value="Manage Measurement Fits" checked={ checkboxItem.includes("Manage Measurement Fits") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID7">Manage Measurement Fits</label>
            </label>
            <label className="full_label">
              <input type="checkbox" id="chkAdminModuleID5" value="Manage Pipings" checked={ checkboxItem.includes("Manage Pipings") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkAdminModuleID5">Manage Pipings</label>
            </label>
          </div>
        </div>
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="role_block">
            <h4>Factory Module</h4>
            <label className="full_label">
              <input type="checkbox" id="chkFactoryModuleID1" value="Manage Tailers" checked={ checkboxItem.includes("Manage Tailers") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkFactoryModuleID1">Manage Tailers</label> 
            </label>
            <label className="full_label">
               <input type="checkbox" id="chkFactoryModuleID2" value="Manage Positions" checked={ checkboxItem.includes("Manage Positions") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID2">Manage Positions</label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID3" value="Manage Extra Payments" type="checkbox" checked={ checkboxItem.includes("Manage Extra Payments") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID3">Manage Extra Payments</label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID4" value="Manage Extra Payment Categories" type="checkbox" checked={ checkboxItem.includes("Manage Extra Payment Categories") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID4">Manage Extra Payment Categories</label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID5" value="Payment Summary" type="checkbox" checked={ checkboxItem.includes("Payment Summary") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID5">Payment Summary </label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID6" value="Work Payment History" type="checkbox" checked={ checkboxItem.includes("Work Payment History") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID6">Work Payment History </label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID7" value="Add Worker Advance Payment" type="checkbox" checked={ checkboxItem.includes("Add Worker Advance Payment") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID7">Add Worker Advance Payment </label> 
             </label>
          </div>
        </div>
      </div>
      <div className="form-group row">
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="role_block">
            <h4>Invoice Module</h4>
            <label className="full_label">
               <input type="checkbox" id="chkInvoiceModuleID1" value="Create Invoice" checked={ checkboxItem.includes("Create Invoice") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID1">Create Invoice</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkInvoiceModuleID2" value="Invoice History" checked={ checkboxItem.includes("Invoice History") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID2">Invoice History</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkInvoiceModuleID3" value="Paid Invoice" checked={ checkboxItem.includes("Paid Invoice") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID3">Paid Invoice</label>
             </label>
          </div>
        </div>
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="role_block">
            <h4>Order Module</h4>
            <label className="full_label">
               <input type="checkbox" id="chkOrderModuleID1" value="Search Orders" checked={ checkboxItem.includes("Search Orders") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID1">Search Orders</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID2" value="New Order" checked={ checkboxItem.includes("New Order") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID2">New Order</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID3" value="Modified" checked={ checkboxItem.includes("Modified") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID3">Modified</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID4" value="Processing" checked={ checkboxItem.includes("Processing") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID4">Processing</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID5" value="Ready for Shipping" checked={ checkboxItem.includes("Ready for Shipping") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID5">Ready for Shipping</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID6" value="Sent" checked={ checkboxItem.includes("Sent") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID6">Sent</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID7" value="Manual Order" checked={ checkboxItem.includes("Manual Order") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID7">Manual Order</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID8" value="Add" checked={ checkboxItem.includes("Add") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID8">Add</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID9" value="View" checked={ checkboxItem.includes("View") ? true:false } onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID9">View</label>
             </label>
          </div>
        </div>
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="role_block">
            <h4>Shipping Module</h4>
            <label className="full_label">
              <input type="checkbox" id="chkShippingModuleID" value="Shipping Box Report" checked={ checkboxItem.includes("Shipping Box Report") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkShippingModuleID">Shipping Box Report</label> 
            </label>
           
            <label className="full_label">
              <input id="chkShippingModuleID2" value="Order Status Barcoding" type="checkbox" checked={ checkboxItem.includes("Order Status Barcoding") ? true:false } onChange={handleCheckboxChange}/>
              <label htmlFor="chkShippingModuleID2">Order Status Barcoding</label>
            </label>
          </div>
        </div>
      
      </div>
      <div className="form-group text-right save_button_NM">
         <input className="btn site_btn custom-btn" value="SAVE" type="submit"/>
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
                Role updated successfully !
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
    </form>
    </div>

    </div>
  </main>   
  )
}