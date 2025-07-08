import React, { useState, useRef, useContext } from "react";
import { Context } from "../../context/Context";
import "./login.css";
import { useNavigate } from "react-router-dom";
import Whitelogo from "./../../images/Whitelogo.png";
import Loginbg from "./../../images/Loginbg.png";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { Grid, TextField, Button, Card, InputAdornment } from "@mui/material";
import { PersonOutline } from "@mui/icons-material";
import KeyIcon from "@mui/icons-material/Key";
import LoginIcon from "@mui/icons-material/Login";
import { Link } from "react-router-dom";
import { Container, Col } from "react-bootstrap";
import { axiosInstance } from "../../config";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function Login() {
  // const navigate = useNavigate();
  const userRef = useRef();
  const passwordRef = useRef();
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { dispatch, isFetching } = useContext(Context);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    if (userRef.current.value === "" || passwordRef.current.value === "") {
      setError(true);
      setOpen(true);
      setErrorMsg("username and password cannot be empty!");
    } else {
      dispatch({ type: "LOGIN_START" });
      try {
        const res = await axiosInstance.post("auth/login", {
          username: userRef.current.value,
          password: passwordRef.current.value
        });
        if (res.data.status == true) {
          dispatch({ type: "LOGIN_SUCCESS", payload: res.data });
          // navigator("/")
        } else {
          setError(true);
          setOpen(true);
          setErrorMsg(res.data.message);
          dispatch({ type: "LOGIN_FAILURE" });
        }
      } catch (e) {
        setError(true);
        setOpen(true);
        setErrorMsg(e.data.message);
        dispatch({ type: "LOGIN_FAILURE" });
      }
    }
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
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
    <>
      <section
        className="login-section"
        style={{ backgroundImage: "url(" + Loginbg + ")" }}
      >
        <div className="logobox">
          <img src={Whitelogo} alt="Logo" />
        </div>

        <Container container spacing={2}>
          <Card Item xs={4} zeroMinWidth className="form-width-nav">
            <Col className="title-name" xs={12}>
              <h1> Login </h1>
            </Col>
            <form onSubmit={handleSubmit}>
              <Container spacing={2} className="pd-20">
                <Col item xs={12}>
                  <Grid item className="custom-form-group">
                    <TextField
                      variant="outlined"
                      fullWidth
                      placeholder="User Name"
                      className="form-control"
                      inputRef={userRef}
                      autoFocus
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutline />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Col>
                <Col item xs={12}>
                  <Grid item className="custom-form-group">
                    <TextField
                      variant="outlined"
                      fullWidth
                      type="password"
                      className="form-control"
                      inputRef={passwordRef}
                      placeholder="Password"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <KeyIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Col>
              </Container>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                className="custom-btn-nav"
                disabled={isFetching}
                color="primary"
              >
                <LoginIcon className="loginicon" />
                Login
              </Button>

              <Container className="rightalignnavm">
                <Grid item className="d-flex forget-pd">
                  <Link to="#" variant="body2">
                    Forget Password?
                  </Link>
                  <p> Have Questions? </p>
                </Grid>
              </Container>
            </form>
          </Card>
          {error && (
            <Snackbar
              open={open}
              autoHideDuration={4000}
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
        </Container>
      </section>
    </>
  );
}
