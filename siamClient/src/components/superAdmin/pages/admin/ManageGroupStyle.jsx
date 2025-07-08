import React from "react";
import "./admin.css";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageGroupStyling() {
  const [groupFeatures, setGroupFeatures] = useState([]);
  const [products, setProducts] = useState([]);
  const { user } = useContext(Context);
  const [groupFeatureId, setGroupFeatureId] = useState("");
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);

  useEffect(() => {
    const fetchGroupFeatures = async () => {
      const res1 = await axiosInstance.post("/product/fetchAll/0/0", { token: user.data.token });
      setProducts(res1.data.data)

      const res = await axiosInstance.post("/groupFeatures/fetchAll", { token: user.data.token })
      setGroupFeatures(res.data.data)
    }
    fetchGroupFeatures()
  }, []);

  const handleSearchSubmit = async (e) => {
    if (e.target.value === "all") {
      const res = await axiosInstance.post("/groupFeatures/fetchAll", { token: user.data.token })
      setGroupFeatures(res.data.data)
    } else {
      const res = await axiosInstance.post("groupFeatures/fetchFeatures/" + e.target.value, { token: user.data.token })
      setGroupFeatures(res.data.data)
    }
  };

  const handleClickOpen = (id) => {
    setOpen2(true);
    setGroupFeatureId(id);
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDelete = async () => {
    const res1 = await axiosInstance.post("/groupFeatures/delete/" + groupFeatureId, {
      token: user.data.token,
    });
    if (res1) {
      const res = await axiosInstance.post("/groupFeatures/fetchAll", {
        token: user.data.token,
      });
      setGroupFeatures(res.data.data)
      setOpen2(false);
      setOpen(true);
      setSuccess(true);
    }
  };
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
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
          <div className="manage-button-head">
            <div className="manage-button-head-inner">
              <strong>Manage Group Style</strong>
            </div>
            <div style={{ display: "inline-block", padding: "15px" }}>
              <Link to="/admin/addGroupStyle" className="b-btn" style={{ marginRight: "15px" }}>
                Create Group Style
              </Link>
            </div>
          </div>
          <div className="searchstyle">
            <p>Select Product</p>
            <select
              name="product"
              id="product"
              className="searchinput"
              onChange={(e) => handleSearchSubmit(e)}
            >
              <option value="all">All Product</option>
              {products.map((product) => (
                <option value={product._id}>{product.name}</option>
              ))}
            </select>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>OPTION CHOICE NAME</th>
                <th>THAI OPTION CHOICE NAME</th>
                <th>ADDITIONAL</th>
                <th>TYPE</th>
                <th>OPTION</th>
              </tr>
            </thead>
            <tbody>

              {
                groupFeatures.map((groupfeature, key) => {

                  return (

                    <tr key={key}>
                      <td>{groupfeature.product_id.name}</td>
                      <td>{groupfeature.name}</td>
                      <td>{groupfeature.thai_name}</td>
                      <td>
                        <strong>
                          {groupfeature.additional == true ? "Yes" : "No"}
                        </strong>
                      </td>
                      <td>
                        <strong>Group</strong>
                      </td>
                      <td>
                        <strong>
                          <Link
                            to={`/admin/editGroupStyle/${groupfeature._id}`}
                            className="action"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleClickOpen(groupfeature._id)}
                            className="delete"
                          >
                            Delete
                          </button>
                        </strong>
                      </td>
                    </tr>
                  )

                })
              }
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
        <DialogTitle id="alert-dialog-title">{"Confirmation?"}</DialogTitle>
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
            deleted successfully!
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
