import React from "react";
import './admin.css'
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageWorkers(){

   const [factoryUsers,  setfactoryUsers] = useState([])
   const { user } = useContext(Context)
   const [factoryUserId,  setfactoryUserId] = useState("")
   const [success, setSuccess] = useState(false)
   const [open, setOpen] = useState(false)
   const [open2, setOpen2] = useState(false)

    useEffect(()=> {
        const fetchfactoryUsers = async () => {
           const res = await axiosInstance.post("/auth/fetchAll", {token:user.data.token})
           setfactoryUsers(res.data.data)
        }
        fetchfactoryUsers()
    }, [])

    const handleClickOpen = (id) => {
       setOpen2(true)
       setfactoryUserId(id)
    };

    const handleClose2 = () => {
       setOpen2(false)
    }

    const handleDelete = async () => {
      const deleteData = {
        id:factoryUserId,
        token:user.data.token
      }
      
      const res = await axiosInstance.post("/auth/delete", deleteData)
      setfactoryUsers(res.data.data)
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
                <strong>Manage Factory Users</strong>
                <Link to="/admin/addUser" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New User </Link>
                </div>
                <table className="table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>USERNAME</th>
                    <th>PASSWORD</th>
                    <th>E-MAIL</th>
                    <th>ROLE</th>
                    <th>OPTION</th>
                  </tr>
                </thead>
                <tbody>
                    { factoryUsers.map((factoryUser, key) => (
                        <tr key={key}>
                        <td><strong>{factoryUser.worker_name==null ? "Super Admin" : factoryUser.worker_name.charAt(0).toUpperCase() + factoryUser.worker_name.slice(1)}</strong></td>
                        <td>{factoryUser.username}</td>
                        <td>{factoryUser.password}</td>
                        <td>{factoryUser.email==null ? "sanjcreations@gmail.com" : factoryUser.email}</td>
                        <td>{factoryUser.role.charAt(0).toUpperCase() + factoryUser.role.slice(1)}</td>
                        <td><strong>{factoryUser.role === "administrator" ? "NA" :<span> <Link to={`/admin/addUser/${factoryUser._id}`} className="action">Edit</Link> | <button onClick={()=>handleClickOpen(factoryUser._id)} className="delete">Delete</button></span>}</strong></td>
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