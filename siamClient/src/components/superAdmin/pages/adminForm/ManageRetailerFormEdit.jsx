import React, { useState, useContext, useEffect } from 'react'
import { Context } from '../../../../context/Context'
import { axiosInstance } from '../../../../config'
import { useLocation } from 'react-router-dom';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { PicBaseUrl } from '../../../../imageBaseURL';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageRetailerFormEdit() {

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
  const [logo, setLogo] = useState("")
  const [file, setFile] = useState(null)
  const { user } = useContext(Context)
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation()
  const id = location.pathname.split('/')[3]

  const getData = {
    id: id,
    token: user.data.token
  }

  useEffect(() => {
    const fetchRetailer = async () => {
      const res = await axiosInstance.post("retailer/fetch", getData)
      setRetailerName(res.data.data[0].retailer_name)
      setOwnerName(res.data.data[0].owner_name)
      setRetailerCode(res.data.data[0].retailer_code)
      setEmail(res.data.data[0].email)
      setUsername(res.data.data[0].username)
      setPassword(res.data.data[0].password)
      setAddress(res.data.data[0].address)
      setCountry(res.data.data[0].country)
      setCellphone(res.data.data[0].phone)
      setEmailRecipients(res.data.data[0].email_recipients)
      setMonogram(res.data.data[0].monogram_tagline)
      setLogo(res.data.data[0].retailer_logo)
    }
    fetchRetailer()
  }, [])
  const handleSubmit = async (e) => {
    e.preventDefault()
    const newRetailer = {
      user: {
        retailer_name: retailerName,
        owner_name: ownerName,
        retailer_code: retailerCode,
        email: email,
        username: username,
        password: password,
        address: address,
        country: country,
        phone: cellphone,
        email_recipients: emailRecipients,
        monogram_tagline: monogram
      },
      token: user.data.token
    }

    if (retailerName == "" || ownerName == "" || retailerCode == "" || username == "" || password == "" || email == "" || emailRecipients == "") {
      setOpen(true)
      setError(true)
      setErrorMsg("Please fill this Input !")
    } else {
      try {
        if (file) {
          const data = new FormData();
          data.append("image", file);
          const res = await axiosInstance.post("image/upload", data)
          newRetailer.user.retailer_logo = res.data.data
        }
        const res = await axiosInstance.put("/retailer/update", newRetailer)
        if (res.data.status == true) {
          setOpen(true)
          setSuccess(true)
        } else {
          setOpen(true)
          setError(true)
          setErrorMsg(res.data.message)
        }
      } catch {

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
            <strong>Edit Retailer</strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <div className="searchinput-inner col">
                  <label>Retailer Name <span className="red-required">*</span></label>
                  <input type="text" className="searchinput" value={retailerName} onChange={(e) => setRetailerName(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Owner Name <span className="red-required">*</span></label>
                  <input type="text" className="searchinput" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Retailer Code <span className="red-required">*</span></label>
                  <input type="text" className="searchinput" value={retailerCode} onChange={(e) => setRetailerCode(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Email Address<span className="red-required">*</span></label>
                  <input type="email" className="searchinput" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Username <span className="red-required">*</span></label>
                  <input type="text" className="searchinput" value={username} onChange={(e) => setUsername(e.target.value)} disabled />
                </div>
                <div className="searchinput-inner col">
                  <label>Password <span className="red-required">*</span></label>
                  <input type="text" className="searchinput" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Address</label>
                  <input type="text" className="searchinput" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Country</label>
                  <select value={country} className="searchinput" onChange={(e) => setCountry(e.target.value)}>
                    <option> - Select Country - </option>
                    <option value="India">India</option>
                    <option value="Thailand">Thailand</option>
                    <option value="China">China</option>
                  </select>
                </div>
                <div className="searchinput-inner col">
                  <label>Cell Phone</label>
                  <input type="text" className="searchinput" value={cellphone} onChange={(e) => setCellphone(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Email Recipients<span className="red-required">*</span></label>
                  <input type="email" className="searchinput" value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <label>Monogram Tag Line</label>
                  <input type="text" className="searchinput" value={monogram} onChange={(e) => setMonogram(e.target.value)} />
                </div>
                <div className="searchinput-inner col">
                  <div className="input-file-outer">
                    <label className='input-file-button' htmlFor="fileInput">CHOOSE FILE</label>
                    {file ?
                      <img src={URL.createObjectURL(file)} alt="" style={{ height: 100, width: 100 }} />
                      :
                      logo == null ? <></>
                        :
                        <img src={PicBaseUrl + logo} alt="" style={{ height: 100, width: 100 }} />
                    }
                    <input type="file" name='image' id="fileInput" className="inputfile-button" onChange={(e) => setFile(e.target.files[0])} />
                  </div>
                </div>
                <div className="col savesumitbtnnm">
                  <input type="submit" className="custom-btn" value="SAVE" />
                </div>
              </div>
            </form>
          </div>
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
            Retailer updated successfully!
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
