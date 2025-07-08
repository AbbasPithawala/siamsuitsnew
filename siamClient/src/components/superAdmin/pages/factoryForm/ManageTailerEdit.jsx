import React, { useState, useEffect, useContext } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import { useNavigate, useParams } from "react-router-dom"
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import validator from "validator";
import { PicBaseUrl } from "../../../../imageBaseURL";

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageTailerEdit() {

    const [firstname, setFirstname] = useState("")
    const [lastname, setLastname] = useState("")
    const [thaifullname, setThaifullname] = useState("")
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [positions, setPositions] = useState([])
    const [positionchk, setPositionchk] = useState([])
    const [phone, setPhone] = useState("")
    const [file, setFile] = useState(false)
    const { user } = useContext(Context)
    const navigate = useNavigate();
    const { id } = useParams();
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")
    const [error, setError] = useState(false)
    const [open, setOpen] = useState(false)
  const [processes, setProcesses] = useState([])  
  const [process, setProcess] = useState([])

    useEffect(() => {
     
    fetchProcesses();

        const fetchTailer = async () => {
            const res = await axiosInstance.post(`/tailer/fetch/${id}`, { token: user.data.token })
            console.log("response: ", res.data)
            setFirstname(res.data.data[0].firstname)
            setLastname(res.data.data[0].lastname)
            setThaifullname(res.data.data[0].thai_fullname)
            setFile(res.data.data[0].image)
            setPositionchk(res.data.data[0].process_id)
            setUsername(res.data.data[0].username)
            setPassword(res.data.data[0].password)
            setPhone(res.data.data[0].phone)
        }
        fetchTailer()
    }, [])

    console.log("bdhkjsabda ", positionchk)
  const handleCheckboxChange = async (e) => {
    if (e.target.checked) {
        setPositionchk([...positionchk, e.target.value])
    } else {
      const updatedSelectedItem = positionchk.filter(
        (selectedItem) => selectedItem !== e.target.value
      );
      setPositionchk(updatedSelectedItem);
    }
  }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const newTailer = {
            tailer: {
                firstname: firstname,
                lastname: lastname,
                thai_fullname: thaifullname,
        process_id: positionchk,
                username: username,
                password: password,
                phone: phone
            },
            token: user.data.token
        }
        if (firstname == "" || setLastname == "" || thaifullname == "" || username == "" || password == "" || phone == "") {
            setOpen(true)
            setError(true)
            setErrorMsg("Please fill this input!")
        } else {
            if (file) {
                const data = new FormData();
                data.append("image", file);
                const res = await axiosInstance.post("image/upload", data)
                newTailer.tailer.image = res.data.data
            }
            const res = await axiosInstance.put("/tailer/update/" + id, newTailer)
            if (res.data.status == true) {
                setOpen(true)
                setSuccess(true)
                setTimeout(() => {
                    navigate("/factory/tailers")
                }, 1000)

            } else {
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

      // ================================================================
    const fetchProcesses = async() => {
        const res = await axiosInstance.post("/product/fetchProcess", {
        token: user.data.token,
        });
        setProcesses(res.data.data)
    }
  // ================================================================

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

    return (
        <main className="main-panel">
            <div className="content-wrapper">
                <div className="order-table manage-page">
                    <div className="top-heading-title">
                        <strong> Edit Tailor </strong>
                    </div>
                    <div className="factory-user-from-NM pd-15">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group row">
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>First Name <span className="red-required">*</span></p>
                                        <input className="searchinput" type="text" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>Last Name <span className="red-required">*</span></p>
                                        <input className="searchinput" type="text" value={lastname} onChange={(e) => setLastname(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>Thai Full Name <span className="red-required">*</span></p>
                                        <input className="searchinput" type="text" value={thaifullname} onChange={(e) => setThaifullname(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <div className="input-file-outer">
                                            <label className='input-file-button' htmlFor="fileInput">CHOOSE FILE</label>
                                            {file ?
                                                <img src={URL.createObjectURL(file)} alt="custom-pic" />
                                                :
                                                // <></>
                                                <img src={PicBaseUrl + "avt.png"} alt="custom-pic" />
                                            }
                                            <input type="file" name='image' id="fileInput" className="inputfile-button" onChange={(e) => setFile(e.target.files[0])} />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="role_block">
                                          {processes.map((process, i) => (
                                                <label className="full_label" key={i}>
                                                <input type="checkbox" id={`chk${process.name}`} value={process._id} checked={positionchk.includes(process._id)} onChange={handleCheckboxChange} />
                                                <label htmlFor={`chk${process.name}`}>{process.name}</label>
                                            </label>
                                            ))}
                                    </div>
                                </div>
                            </div>
                            <br />
                            <div className="top-heading-title">
                                <strong> App Login </strong>
                            </div>
                            <hr />
                            <div className="form-group row">
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>Username</p>
                                        <input className="searchinput" type="text" value={username} onChange={(e) => setUsername(e.target.value)} disabled/>
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>Password</p>
                                        <input className="searchinput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-4" style={{ padding: "0 15px" }}>
                                    <div className="searchinput-inner">
                                        <p>Phone</p>
                                        <input className="searchinput" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-sm-4 savesumitbtnnm">
                                    <input type="submit" className="custom-btn" value="SAVE" />
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
                                        Tailer updated successfully!
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