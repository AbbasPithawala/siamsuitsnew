import React, { useState, useEffect } from "react";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function SnackBar(props) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [showSnackBar, setShowSnackBar] = useState(false);

  useEffect(() => {
    setSuccess(props.success)

  }, [props])

  
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };

  return (
    <>
      {props.success && (
        <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {props.successMsg}
          </Alert>
        </Snackbar>
      )}
      {props.error && (
        <Snackbar
          open={open}
          autoHideDuration={2000}
          onClose={handleClose}
        >
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
          {props.successMsg}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}