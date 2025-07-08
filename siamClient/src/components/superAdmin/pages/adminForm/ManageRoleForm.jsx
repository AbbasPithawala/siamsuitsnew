import React, { useState, useContext } from "react";
import { axiosInstance } from "./../../../../config";
import { useNavigate } from "react-router-dom";
import { Context } from "../../../../context/Context";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import validator from "validator";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageRoleForm(){
  const [role, setRole] = useState("")
  const [checkboxItem, setCheckboxItem] = useState([])
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate()
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState({
    role:false,
  })

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
          const res = await axiosInstance.post("/roles/create", newRole)
          if(res.data.status==true){
            setOpen(true)
            setSuccess(true)
            setRole("")
            setCheckboxItem([])
            setTimeout(() => {
              navigate(`/admin/roles`);
            }, 1000);
          }else{
            setOpen(true)
            setError(true)
            setErrorMsg(res.data.message)
          }    
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

   return(
   <main className="main-panel">
     <div className="content-wrapper">
      <div className="top-heading-title">
       <strong>Add Role </strong>
      </div>

     <div className="admin-from-style-NM">
     <form onSubmit={handleSubmit}>
         <div className={validationError.role ? "form-group error-handle" : "form-group"}>
           <label>Role Name <span className="red-required">*</span></label>
           <input 
            type="text"
            className="searchinput"
            value={role}
            onChange={(e) => setRole(e.target.value)}
           />
         </div>
       <div className="form-group row">
         <div className="col-md-4 col-sm-4 col-xs-12">
           <div className="role_block">
             <h4>Admin Module</h4>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID1" value="Manage Roles" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID1">Manage Roles</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkFactoryModuleID2" value="Manage User Login" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID2">Manage User Login</label> 
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID2" value="Manage Products" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID2">Manage Products </label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID3" value="Manage Retailers" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID3">Manage Retailers</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID4" value="Manage Measurements" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID4">Manage Measurements</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID5" value="Manage Styling Options" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID5">Manage Styling Options</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID51" value="Manage Group Styling" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID51">Manage Group Styling</label>
             </label>
            <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID6" value="Manage Retailer Styling" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID6">Manage Retailer Styling</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID7" value="Manage Measurement Fits"  onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID7">Manage Measurement Fits</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkAdminModuleID8" value="Manage Pipings" onChange={handleCheckboxChange}/>
               <label htmlFor="chkAdminModuleID8">Manage Pipings</label>
             </label>
           </div>
         </div>
         <div className="col-md-4 col-sm-4 col-xs-12">
           <div className="role_block">
             <h4>Factory Module</h4>
             <label className="full_label">
               <input type="checkbox" id="chkFactoryModuleID1" value="Manage Tailers" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID1">Manage Tailers</label> 
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkFactoryModuleID2" value="Manage Positions" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID2">Manage Positions</label> 
             </label>

             <label className="full_label">
               <input id="chkFactoryModuleID3" value="Manage Extra Payments" type="checkbox" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID3">Manage Extra Payments</label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID4" value="Manage Extra Payment Categories" type="checkbox" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID4">Manage Extra Payment Categories</label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID5" value="Payment Summary" type="checkbox" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID5">Payment Summary </label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID6" value="Work Payment History" type="checkbox" onChange={handleCheckboxChange}/>
               <label htmlFor="chkFactoryModuleID6">Work Payment History </label> 
             </label>
             <label className="full_label">
               <input id="chkFactoryModuleID7" value="Add Worker Advance Payment" type="checkbox" onChange={handleCheckboxChange}/>
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
               <input type="checkbox" id="chkInvoiceModuleID1" value="Create Invoice" onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID1">Create Invoice</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkInvoiceModuleID2" value="Invoice History" onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID2">Invoice History</label>
             </label>
             <label className="full_label">
               <input type="checkbox" id="chkInvoiceModuleID3" value="Paid Invoice" onChange={handleCheckboxChange}/>
               <label htmlFor="chkInvoiceModuleID3">Paid Invoice</label>
             </label>
           </div>
         </div>
         <div className="col-md-4 col-sm-4 col-xs-12">
           <div className="role_block">
             <h4>Order Module</h4>
             <label className="full_label">
               <input type="checkbox" id="chkOrderModuleID1" value="Search Orders" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID1">Search Orders</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID2" value="New Order" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID2">New Order</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID3" value="Modified" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID3">Modified</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID4" value="Processing" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID4">Processing</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID5" value="Ready for Shipping" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID5">Ready for Shipping</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID6" value="Sent" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID6">Sent</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID7" value="Manual Order" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID7">Manual Order</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID8" value="Add" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID8">Add</label>
             </label>
             <label className="full_label"> 
               <input type="checkbox" id="chkOrderModuleID9" value="View" onChange={handleCheckboxChange}/>
               <label htmlFor="chkOrderModuleID9">View</label>
             </label>
           </div>
         </div>
         <div className="col-md-4 col-sm-4 col-xs-12">
           <div className="role_block">
             <h4>Shipping Module</h4>
             <label className="full_label">
               <input type="checkbox" id="chkShippingModuleID" value="Shipping Box Report" onChange={handleCheckboxChange}/>
               <label htmlFor="chkShippingModuleID">Shipping Box Report</label> 
             </label>
            
             <label className="full_label">
               <input id="chkShippingModuleID2" value="Order Status Barcoding" type="checkbox" onChange={handleCheckboxChange}/>
               <label htmlFor="chkShippingModuleID2">Order Status Barcoding</label>
             </label>
           </div>
         </div>
       
       </div>
       <div className="form-group text-right save_button_NM">
         <input className="custom-btn" value="SAVE" type="submit"/>
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
                 Role created successfully! 
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