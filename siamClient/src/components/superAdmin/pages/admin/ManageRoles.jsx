import React from "react";
import './admin.css'
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
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


export default function ManageRoles(){

  const [roles, setRoles] = useState([])
  const { user } = useContext(Context)
  const [open2, setOpen2] = useState(false);
  const [roleId, setRoleId] = useState("")
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);



  const handleClickOpen = (id) => {
    setOpen2(true);
    setRoleId(id)
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  useEffect(()=>{
    const fetchRole = async() =>{
      const res = await axiosInstance.post("/roles/fetchAll", {token:user.data.token})
      setRoles(res.data.data)
    }
    fetchRole()
  },[])

    const handleDelete = async () => {
      const deleteData = {
        id:roleId,
        token:user.data.token
      }
    
      const res = await axiosInstance.post("/roles/delete", deleteData)
      setRoles(res.data.data)
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
        <>
        <main className="main-panel">
            <div className="content-wrapper">
            <div className="order-table manage-page">
                <div className="top-heading-title">
                <strong>Manage Roles</strong>
                <Link to="/admin/addRole" className="custom-btn"> <i className="fa-solid fa-plus"></i> Add New Member </Link>
                </div>
                <table className="table">
                 <thead>
                    <tr>
                    <th>ROLE NAME </th>
                    <th>MODULES </th>
                    <th>OPTION </th>
                    </tr>
                </thead>
                <tbody className="manage-rule">
                    {roles.map((role, key)=>(
                       <tr key={key}>
                       <td><strong>{role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1)}</strong> </td>
                       <td>{role.modules.join(", ")}</td>
                       <td><strong>{role.role_name === "administrator" ? "NA" :<span> <Link to={`/admin/addRole/${role._id}`} className="action">Edit</Link> | <button onClick={()=>handleClickOpen(role._id)} className="delete">Delete</button></span>}</strong></td>
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
              Role deleted successfully!
            </Alert>
          </Snackbar>
        )}
        </main>
      </>
    )
}