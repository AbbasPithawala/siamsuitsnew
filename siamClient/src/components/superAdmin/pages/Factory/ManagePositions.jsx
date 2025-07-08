import React from "react";
import './factory.css'
import { Link } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
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

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManagePositions(){

   const [positions, setPositions] = useState([])
   const { user } = useContext(Context)
   const [positionId, setPositionId] = useState("")
   const [success, setSuccess] = useState(false)
   const [open, setOpen] = useState(false)
   const [open2, setOpen2] = useState(false)

   const fetchPositions = async() => {
    const res = await axiosInstance.post("/position/fetchAll", {token:user.data.token})
    setPositions(res.data.data)
   }

   useEffect(()=>{
     fetchPositions()
   }, [])

   const handleClickOpen = (id) => {
    setOpen2(true)
    setPositionId(id)
 };

 const handleClose2 = () => {
    setOpen2(false)
 }

 const handleDelete = async () => {
   const res = await axiosInstance.post(`/position/delete/${positionId}`, {token:user.data.token})
   if(res){
    const res1 = await axiosInstance.post("/position/fetchAll", {token:user.data.token})
    setPositions(res1.data.data)
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
                <strong>Manage Positions</strong>
                <Link to="/factory/addPosition" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New Positions </Link>
                </div>
                <table className="table">
                <thead>
                  <tr>
                    <th>POSITION NAME</th>
                    <th>THAI POSITION NAME</th>
                    <th>DESCRIPTION</th>
                    <th>COST</th>
                    <th>OPTION</th>
                  </tr>
                </thead>
                <tbody>
                    {positions.map((position)=>(
                      <tr>
                        <td>{position.name}</td>
                        <td>{position.thai_name}</td>
                        <td>{position.description}</td>
                        <td>{position.cost}</td>
                        <td><strong><Link to={`/factory/editPosition/${position._id}`} className="action">Edit</Link> | <button onClick={()=>handleClickOpen(position._id)} className="delete">Delete</button></strong></td>
                      </tr>
                    ))}
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