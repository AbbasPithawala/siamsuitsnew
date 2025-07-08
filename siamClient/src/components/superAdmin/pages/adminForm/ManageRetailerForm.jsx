import React, {useState, useContext} from 'react'
import { Context } from '../../../../context/Context'
import { axiosInstance } from '../../../../config'
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { countries } from './countries';
import RetailerHeader from '../../../retailerAdmin/RetailerHeader/RetailerHeader';
import { ElevatorSharp } from '@mui/icons-material';
// import react-loader-spinner from "react-loader-spinner";
import { RotatingLines } from 'react-loader-spinner'
import validator from 'validator';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageRetailerForm() {

  const [retailerName, setRetailerName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [retailerCode, setRetailerCode] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [address, setAddress] = useState("")
  const [country, setCountry] = useState("")
  const [cellphone, setCellphone] = useState("")
  const [emailRecipients, setEmailRecipients] = useState("")
  const [monogram, setMonogram] = useState("")
  const [file, setFile] = useState(null)
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [createRetailerButton, setCreateRetailerButton] = useState(false)
  const [retailerCodeAlreadyExists, setRetailerCodeAlreadyExists] = useState(true)
  const [ifRetailerCodeExistText, setIfRetailerCodeExistText] = useState("")
  const [retailerCodeAvailable, setRetailerCodeAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [validationError, setValidationError] = useState({
    retailerName: false,
    ownerName: false,
    retailerCode: false,
    username: false,
    password: false
  })

    const handleSubmit = async(e) =>{
      setCreateRetailerButton(true)
      setIsLoading(true)
      e.preventDefault()
      const newRetailer = {
        user:{
          retailer_name:retailerName,
          owner_name:ownerName,
          retailer_code:retailerCode,
          email:email,
          username:username,
          password:password,
          address:address,
          country:country,
          phone:cellphone,
          email_recipients:emailRecipients,
          monogram_tagline:monogram
        },
        token:user.data.token
      }

      if(validator.isEmpty(retailerName)){
        setValidationError({retailerName: retailerName.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill retailer name!")
      }else if(validator.isEmpty(ownerName)){
        setValidationError({ownerName: ownerName.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill owner name!")
      }else if(validator.isEmpty(retailerCode)){
        setValidationError({retailerCode: retailerCode.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill retailer code!")
      }else if(validator.isEmpty(username)){
        setValidationError({username: username.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill username!")
      }else if(validator.isEmpty(email)){
        setValidationError({username: username.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill email!")
      }else if(validator.isEmpty(password)){
        setValidationError({password: password.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill password!")
      }else if(validator.isEmpty(emailRecipients)){
        setValidationError({emailRecipients: emailRecipients.length === 0})
        setOpen(true)
        setError(true)
        setCreateRetailerButton(false)
        setIsLoading(false)
        setErrorMsg("Please fill Recipient Email!")
      }else{
        try {
          if(file){
            const data = new FormData();
            data.append("image", file);
            const res = await axiosInstance.post("image/upload", data)
            newRetailer.user.retailer_logo = res.data.data
          }
          const res = await axiosInstance.post("/retailer/create", newRetailer)
          if(res.data.status==true){
            setOpen(true)
            setSuccess(true)
            setCreateRetailerButton(false)
            setIsLoading(false)
            setRetailerName("")
            setOwnerName("")
            setRetailerCode("")
            setEmail("")
            setUsername("")
            setPassword("")
            setAddress("")
            setCountry("")
            setCellphone("")
            setEmailRecipients("")
            setMonogram("")
            setFile(null)

          }else{
            setOpen(true)
            setError(true)
            setErrorMsg(res.data.message)
            setCreateRetailerButton(false)
            setIsLoading(false)
          }    
        }catch{
          setCreateRetailerButton(false)
          setIsLoading(false)
  
        }
      }
    }

    const isValidRetailCode =  async(email) => {
      return /^[A-Z]*$/.test(email);
    }
    const handleCheckRetailerCode = async (e)=>{
      if(e.target.value.length > 5)
     { 
      setRetailerCodeAlreadyExists(false)
      setIfRetailerCodeExistText("Retailer code cant be more than 5 characters")
      
    }else if(e.target.value.length < 3){
      setRetailerCodeAlreadyExists(false)
      setIfRetailerCodeExistText("Retailer code should be atleast upto 3 characters")
    }else if(!isValidRetailCode(e.target.value)) {
      setRetailerCodeAlreadyExists(false)
      setIfRetailerCodeExistText("Should be only letters to (A-Z).")
    }
      else{
        const reqBody = {
          retailer_code: e.target.value,
          token: user.data.token
        }

        const res1 = await axiosInstance.post("/retailer/fetchRetailerCode", reqBody)

        if(res1.data.data != null){
          setIfRetailerCodeExistText("Retailer code already exist")
          setRetailerCodeAlreadyExists(false)
        }else{
          setRetailerCodeAvailable(true)
          setRetailerCodeAlreadyExists(true)
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

  return (
    <main className="main-panel">
        <div className="content-wrapper">
        <div className="order-table manage-page">
        <div className="top-heading-title">
          <strong>Add New Retailer</strong>
        </div>    
        <div className="factory-user-from-NM pd-15">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <div className={validationError.retailerName ? "searchinput-inner error-handle col" : "searchinput-inner col"}>
                        <label>Retailer Name <span className="red-required">*</span></label>
                        <input className="searchinput" type="text" value={retailerName} onChange={(e) => setRetailerName(e.target.value)}/>
                    </div>
                    <div className={validationError.ownerName ? "searchinput-inner error-handle col" : "searchinput-inner col"}>
                        <label>Owner Name <span className="red-required">*</span></label>
                        <input className="searchinput" type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}/>
                    </div>
                    <div className={validationError.retailerCode ? "searchinput-inner error-handle col" : "searchinput-inner col"}>
                      <label>Retailer Code <span className="red-required">*</span></label>
                      <input className={retailerCodeAlreadyExists ? "searchinput" : "searchinput retailerCodeInput"} type="text" maxlength="5" onChange={(e) => setRetailerCode(e.target.value.toUpperCase())} value={retailerCode} onKeyUp={handleCheckRetailerCode}/>
                      <span hidden={retailerCodeAlreadyExists}>{ifRetailerCodeExistText}</span>
                    </div>
                    <div className="searchinput-inner col">
                      <label>Email Address <span className="red-required">*</span></label>
                      <input className="searchinput" type="email" value={email} onChange={(e) => setEmail(e.target.value)}/>
                    </div>
                    <div className={validationError.username ? "searchinput-inner error-handle col" : "searchinput-inner col"}>
                      <label>Username <span className="red-required">*</span></label>
                      <input className="searchinput" type="text" value={username} onChange={(e) => setUsername(e.target.value)}/>
                    </div>
                    <div className={validationError.password ? "searchinput-inner error-handle col" : "searchinput-inner col"}>
                      <label>Password <span className="red-required">*</span></label> 
                      <input className="searchinput" type="text" value={password} onChange={(e) => setPassword(e.target.value)}/>
                    </div>
                    <div className="searchinput-inner col">
                      <label>Address</label>
                      <input className="searchinput" type="text" value={address} onChange={(e) => setAddress(e.target.value)}/>
                    </div>
                    <div className="searchinput-inner col">
                      <label>Country</label>
                      <select className="searchinput" value={country} onChange={(e) => setCountry(e.target.value)}>
                        <option> - Select Country - </option>
                        {countries.length > 1 ?
                        countries.map((single) => {
                          return(
                            <option value={single.name}>{single.name}</option>
                          )
                        })
                      :
                      <></>}
                      </select>
                    </div>
                    <div className="searchinput-inner col">
                        <label>Cell Phone</label>
                        <input className="searchinput" type="text" value={cellphone} onChange={(e) => setCellphone(e.target.value)}/>
                    </div>
                    <div className="searchinput-inner col">
                        <label>Email Recipients<span className="red-required">*</span></label>
                        <input className="searchinput" type="email" value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)}/>
                    </div>
                    <div className="searchinput-inner col">
                        <label>Monogram Tag Line</label>
                        <input className="searchinput" type="text" value={monogram} onChange={(e) => setMonogram(e.target.value)}/>
                    </div>
                  <div className="searchinput-inner col">
                    <div className="input-file-outer">
                    {file &&  
                      <div className='input-file-inner'>
                       <img src={URL.createObjectURL(file)} alt="custom-pic" style={{ height: 100, width: 100 }} /> 
                      <i className="fa fa-times" onClick={()=>setFile(null)}></i>
                      </div>
                    }
                      <div className={file ? 'input-file-inner d-none' : 'input-file-inner'}>                      
                        <label className='input-file-button' htmlFor="fileInput">CHOOSE FILE</label>
                        <input type="file"  name='image' id="fileInput"  className="inputfile-button" onChange={(e) =>setFile(e.target.files[0])}/>
                      </div>
                    </div>
                  </div>
                  <div className="col savesumitbtnnm">
                    <input type="submit" className="custom-btn" disabled={createRetailerButton ? true : false} value={ createRetailerButton ? "Loading.." : "SAVE"} />
                  </div>
                </div>
            </form>
            </div>
        </div>
        </div>
     {
     isLoading ?  
     <RotatingLines
       strokeColor="grey"
       strokeWidth="5"
       animationDuration="0.75"
       width="96"
       visible={true}
     />
      :
    
      <></>
      }

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
                 Retailer created successfully! 
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
    </main>    
  )
}
