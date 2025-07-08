import React from "react";
import './factory.css'
import { Link } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import { PicBaseUrl, PicBaseUrl2, PicBaseUrl3 } from "./../../../../imageBaseURL"
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


export default function ManageTailers() {

  const [tailers, setTailers] = useState([])
  const { user } = useContext(Context)
  const [tailerId, setTailerId] = useState("")
  const [success, setSuccess] = useState(false)
  const [open, setOpen] = useState(false)
  const [open2, setOpen2] = useState(false);


  const fetchTailers = async () => {
    const res = await axiosInstance.post("/tailer/fetchAll", { token: user.data.token })
    setTailers(res.data.data)
  }

  useEffect(() => {
    fetchTailers()
  }, [])

  const handleClickOpen = (id) => {
    setOpen2(true)
    setTailerId(id)
  };

  const handleClose2 = () => {
    setOpen2(false)
  }

  const handleDelete = async () => {
    const res = await axiosInstance.post(`/tailer/delete/${tailerId}`, { token: user.data.token })
    if (res) {
      fetchTailers()
    }
    setOpen2(false)
    setOpen(true)
    setSuccess(true)
  }


  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false)
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


  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Manage Tailers</strong>
            <Link to="/factory/addTailer" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New Tailer </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>THAI NAME</th>
                <th>POSITION</th>
                <th>PHOTO</th>
                <th>OPTION</th>
              </tr>
            </thead>
            <tbody>
              {tailers !== null && tailers.length > 0 ?
                tailers.map((tailer, i) => (
                  <tr key={tailer['_id']}>
                    <td>{`${tailer.firstname} ${tailer.lastname}`}</td>
                    <td>{tailer.thai_fullname}</td>
                    <td style={{textTransform: "capitalize"}}>{tailer.process_id.map((process, i) => ( process.name + ", " ))}</td>
                    <td>{tailer.image == null ? "No Image" : <img src={PicBaseUrl + tailer.image} className="logo-retail" />}</td>
                    <td>
                      <strong>
                        <Link to={`/factory/editTailer/${tailer._id}`} className="action">Edit</Link> |
                        <button onClick={() => handleClickOpen(tailer._id)} className="delete">Delete</button>
                      </strong>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td>No data found!</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={open2}
        onClose={handleClose2}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Confirmation?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose2}>Cancel</Button>
          <Button onClick={handleDelete} autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
      {success && (
        <Snackbar
          open={open}
          autoHideDuration={2000}
          onClose={handleClose}
          action={action}
        >
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            User deleted successfully!
          </Alert>
        </Snackbar>
      )}
    </main>
  )
}