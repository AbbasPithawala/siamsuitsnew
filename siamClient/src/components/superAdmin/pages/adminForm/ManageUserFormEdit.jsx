import React, { useState, useEffect, useContext } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import { useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageUserFormEdit(){

   const location = useLocation()
   const id = location.pathname.split('/')[3]
   const [workerName, setWorkerName] = useState("")
   const [username, setUsername] = useState("")
   const [password, setPassword] = useState("")
   const [email, setEmail] = useState("")
   const [roles, setRoles] = useState([])
   const [role, setRole] = useState("")
   const { user } = useContext(Context)
   const [success, setSuccess] = useState(false)
   const [errorMsg, setErrorMsg] = useState("")
   const [error, setError] = useState(false)
   const [open, setOpen] = useState(false)


    const getData = {
      id:id,
      token:user.data.token
    }

    useEffect(() => {
      const fetchfactoryUser = async () => {
        const res = await axiosInstance.post("/auth/fetch", getData)
        setWorkerName(res.data.data[0].worker_name)
        setUsername(res.data.data[0].username)
        setPassword(res.data.data[0].password)
        setEmail(res.data.data[0].email)
        setRole(res.data.data[0].role)
      }
      fetchfactoryUser()
    },[])

   useEffect(() => {
      const fetchRole = async () => {
         const res = await axiosInstance.post("/roles/fetchAll", {token:user.data.token})
         setRoles(res.data.data)
      }
      fetchRole()
   },[])

  const handleSubmit = async(e) => {
    e.preventDefault()
    const newUser = {
      user:{
       worker_name:workerName,
       username:username,
       password:password,
       email:email,
       role:role
      },
      token:user.data.token
    }
    if(workerName =="" || username=="" || password=="" || role==""){
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill this input!")
    }else{
      const res = await axiosInstance.put("/auth/update", newUser)
      if(res.data.status==true){
        console.log(res)
        setOpen(true)
        setSuccess(true)
      }else{
        setOpen(true)
        setError(true)
        setErrorMsg(res.data.message)
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
  )
 
    return(
      <main className="main-panel">
        <div className="content-wrapper">
          <div className="order-table manage-page">
            <div className="top-heading-title">
              <strong> Edit Factory User </strong>
              </div>
                <div className="factory-user-from-NM pd-15">       
                 <form onSubmit = {handleSubmit}>
                   <div className="form-group">
                      <div className="col">
                        <div className="searchinput-inner">
                           <p>Worker Name <span className="red-required">*</span></p>
                           <input className="searchinput" type="text" value={workerName}  onChange={(e) => setWorkerName(e.target.value)}/>
                        </div>
                      </div>
                      <div className="col">
                       <div className="searchinput-inner">
                         <p>Username <span className="red-required">*</span></p>
                          <input className="searchinput" type="text" value={username} onChange={(e) => setUsername(e.target.value)} disabled/>
                        </div>
                      </div>
                      <div className="col">
                      <div className="searchinput-inner">
                          <p>Password <span className="red-required">*</span></p>
                          <input className="searchinput" type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
                          </div>
                      </div>
                     <div className="col">
                      <div className="searchinput-inner">
                        <p>Email Address</p>
                        <input className="searchinput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="col">
                     <div className="searchinput-inner">
                      <p>Role <span className="red-required">*</span></p>
                       <select className="searchinput" value={role} onChange={(e) => setRole(e.target.value)}>
                        <option >Select a role</option>
                        { roles.map((roless)=>(
                          <option value={roless.role_name}>{roless.role_name.charAt(0).toUpperCase() + roless.role_name.slice(1)}</option>
                        ))}
                      </select>
                     </div>
                    </div>      
                    <div className="col savesumitbtnnm">
                      <input type="submit" className="custom-btn" value="SAVE"/>
                    </div>
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
                        User Updated successfully!
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
        </div>
    </main>
  )
}