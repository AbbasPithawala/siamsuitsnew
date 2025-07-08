import React from "react";
import "./admin.css";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "../../../../config";
import { PicBaseUrl } from "../../../../imageBaseURL";
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
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageWorkers() {
  const [piping, setPiping] = useState([]);
  const { user } = useContext(Context);
  const [id, setId] = useState("");
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(5);
  const [index, setIndex] = useState(0);
  let [name, setName] = useState("");


useEffect(() => {
    fetchData(page, limit, name);
  }, [page]);


  const fetchData = async (page, limit, n) => {
    const res = await axiosInstance.post(
      `/piping/fetchPagination/?page=${page}&limit=${limit}&pipingCode=${n}`,
      {
        token: user.data.token,
      }
    );
    setDoc(res.data.meta.totalDocs);  
    setPiping(res.data.data);
  };

  
  const count = Math.ceil(docLength / limit);

  const handleChange = (e, p) => {
    const val = parseInt(p);
    setIndex(limit * (val - 1));
    setPage(val);
  };

  const handleClickOpen = (id) => {
    setOpen2(true);
    setId(id);
  };

  const searchChange = async (event) => {
    const { value } = event.target;
    name = value;
     setName(value);
    fetchData(1, limit, value.trim());
  };

  const handleClose2 = () => {
    setOpen2(false);
  };

  const handleDelete = async () => {
    const deleteData = {
      id: id,
      token: user.data.token,
    };

    const res = await axiosInstance.post("/piping/delete/" + deleteData.id, {
      token: user.data.token,
    });

    if (res) {
      const res1 = await axiosInstance.post("/piping/fetchAll", {
        token: user.data.token,
      });
      setPiping(res1.data.data);
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
              <strong>Manage Pipings</strong>
            </div>
            <div className="manage-button-head-inner">
              <button type="button" className="custom-btn leftbutton">
                <i className="fa-solid fa-plus"></i> Add Bulk Piping & Category
              </button>
              <button type="button" className="custom-btn leftbutton">
                <i className="fa-solid fa-plus"></i> Add Bulk Piping
              </button>
              <Link to="/admin/addPiping" className="custom-btn">
                <button type="button" className="custom-btn">
                  <i className="fa-solid fa-plus"></i> Add Piping
                </button>
              </Link>
            </div>
          </div>
          <div className="searchstyle searchstyle-one">
            <div className="searchinput-inner">
              <p>Manage Pipings</p>
              <input
                type="text"
                className="searchinput"
                placeholder="Piping Code "
                onChange={searchChange}
              />
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Piping Code</th>
                <th>Suplier Name</th>
                <th>Image</th>
                <th>OPTION</th>
              </tr>
            </thead>
            <tbody>
              {piping !== null && piping.length > 0 ? (
                 piping
                  // .filter((data) => Object.values(data).some((val)=> typeof val === "string" && val.includes(search)))
                  .map((data, key) => (
                    <tr key={key}>
                      <td>
                        <strong>{key + 1 + index}</strong>
                      </td>
                      <td>{data.pipingCode}</td>
                      <td>{data.supplierName.charAt(0).toUpperCase() + data.supplierName.slice(1)}</td>
                      <td>
                        {data.image == null ? (
                          "No Image"
                        ) : (
                          <img
                            src={PicBaseUrl + data.image}
                            //  width={40} height={40}
                            style={{
                              width: "50px",
                              height: "50px",
                              borderRadius: "50%",
                              margin: "2px",
                              objectFit: "cover",
                              objectPosition: "center rigth",
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <strong>
                          {data.role === "administrator" ? (
                            "NA"
                          ) : (
                            <span>
                              <Link
                                to={`/admin/editPiping/${data._id}`}
                                className="action"
                              >
                                Edit |
                              </Link>

                              <button
                                onClick={() => handleClickOpen(data._id)}
                                className="delete"
                              >
                                Delete
                              </button>
                            </span>
                          )}
                        </strong>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td>No data found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Stack spacing={2}>
          <Pagination count={count} page={page} color="primary" onChange={handleChange} />
        </Stack>
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
            Piping deleted successfully!
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
