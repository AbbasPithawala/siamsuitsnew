import React, { useState, useContext, useEffect, useRef } from "react";
import "./Shipment.css";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import { axiosInstance } from "../../../../config";
import { Context } from "./../../../../context/Context";
import Dialog from "@mui/material/Dialog";
import { Button } from "@mui/material";
import { PicBaseUrl } from "./../../../../imageBaseURL";
import ImageUpload from "./../../../../images/ImageUpload.png";
import jsPDF from "jspdf";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function Shipment() {
  const [shippingBoxes, setShippingBoxes] = useState([]);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [shippingBox, setShippingBox] = useState({});
  const { user } = useContext(Context);
  const [open1, setOpen1] = useState(false);
  let htmlElement = useRef(null);

  const fetchShippingBoxes = async () => {
    const res = await axiosInstance.post("/shipping/fetch", {
      token: user.data.token,
      retailer: user.data.id,
    });
    if (res.data.status == true) {
      setShippingBoxes(res.data.data);

      setOpen1(true);
      setSuccess(true);
      setSuccessMsg("Boxes fetched successfully!");
      setError(false);
    } else {
      setShippingBoxes([]);

      setOpen1(true);
      setSuccess(false);
      setErrorMsg("No closed boxes for this retailer!");
      setError(true);
    }
  };

  useEffect(() => {
    fetchShippingBoxes();
  }, []);

  const handleOpenViewShippingBoxDialog = (id) => {
    const shippingBoxArray = shippingBoxes.filter((box) => id == box["_id"]);
    setShippingBox(shippingBoxArray[0]);
    setOpen(true);
  };

  const PackagingPDF = () => {
    let doc = new jsPDF("l", "px", [595, 920]);

    doc.html(htmlElement.current, {
      async callback(doc) {
        window.open(doc.output("bloburl"), "_blank");
      },
    });
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen1(false);
    setError(false);
  };

  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="top-heading-title">
          <strong> Shipping Box Report </strong>
        </div>
        <div className="order-table mt-3">
          <table className="table">
            <thead>
              <tr>
                <th> Sr. No. </th>
                <th> Date </th>
                <th> Box Tracking No </th>
                <th> Retailer </th>
                <th> Product </th>
                <th> Action </th>
              </tr>
            </thead>
            <tbody>
              {shippingBoxes ? (
                shippingBoxes.map((shippingBox, index) => {
                  const itemArray = {};
                  if (shippingBox["items"].length > 0) {
                    for (let x of shippingBox["items"]) {
                      const itemName = x.split("/")[1].split("_")[0];
                      if (Object.keys(itemArray).length > 0) {
                        if (!Object.keys(itemArray).includes(itemName)) {
                          if(itemName == 'suit'){
                            itemArray[itemName] = 0.5
                          }else{                            
                            itemArray[itemName] = 1
                          }
                        } else {
                          if(itemName == 'suit'){                            
                            itemArray[itemName] = itemArray[itemName] +  0.5
                            }else{                   
                              itemArray[itemName] = itemArray[itemName] + 1
                            }
                        }
                      } else {
                        if(itemName == 'suit'){                            
                          itemArray[itemName] = 0.5
                          }else{                   
                            itemArray[itemName] = 1
                          }
                      }
                    }
                  }
                  let itemString = "";
                  for (let x of Object.keys(itemArray)) {
                    itemString = itemString + itemArray[x] + " " + x + " ";
                  }
                  return (
                    <tr key={shippingBox["_id"]}>
                      <td>{index + 1}</td>
                      <td>
                        {new Date(shippingBox["date"]).toLocaleDateString(
                          "en-US"
                        )}
                      </td>
                      <td>{shippingBox["tracking_code"]}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {shippingBox["retailer"]["retailer_name"]}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {itemString}
                      </td>
                      <td>
                        <Button
                          className="Eyebtn"
                          onClick={() =>
                            handleOpenViewShippingBoxDialog(shippingBox["_id"])
                          }
                        >
                          <FileCopyIcon />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>No Closed Box</>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="shippingbox-view">
          <div className="shippingbox-view-heading">
            <strong>View Shipping Box</strong>
          </div>
          <div className="shippingbox-view" ref={htmlElement}>
            <div className="shipping-box-details">
              <div className="shipping-box-content">
                <p>
                  Tracking Number :{" "}
                  <strong>{open ? shippingBox["tracking_code"] : ""}</strong>
                </p>
                <p>
                  Shipping Date :{" "}
                  <strong>
                    {open
                      ? new Date(shippingBox["date"]).toLocaleDateString()
                      : ""}
                  </strong>
                </p>
              </div>
              <div className="shipping-box-thumbnail">
                <img
                  src={
                    open
                      ? shippingBox["retailer"]["retailer_logo"].length > 0
                        ? PicBaseUrl + shippingBox["retailer"]["retailer_logo"]
                        : ImageUpload
                      : ""
                  }
                  width="100"
                  height="100"
                />
                <p>
                  Retailer Name :{" "}
                  <strong>
                    {open ? shippingBox["retailer"]["retailer_name"] : ""}
                  </strong>
                </p>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ORDER NO.</th>
                  <th>CUSTOMER NAME</th>
                  <th>ORDER DATE</th>
                  <th>ORDER DESCRIPTION</th>
                  <th>STATUS</th>
                  <th>MISSING ITEMS</th>
                </tr>
              </thead>
              <tbody>
                {open
                  ? shippingBox["order_id"].map((orders) => {
                      const orderItemObject = {};
                      const remainingItemObject = {};
                      const itemArray = [];
                      for (let x of shippingBox["items"]) {
                        if (x.split("/")[0] == orders["orderId"]) {
                          if (
                            itemArray.includes(x.split("/")[1].split("_")[0])
                          ) {
                            if(x.split("/")[1].split("_")[0] == 'suit'){
                              orderItemObject[x.split("/")[1].split("_")[0]] = orderItemObject[x.split("/")[1].split("_")[0]] + 0.5
                            }else{
                              orderItemObject[x.split("/")[1].split("_")[0]] = orderItemObject[x.split("/")[1].split("_")[0]] + 1 
                            }
                          } else {
                            if(x.split("/")[1].split("_")[0] == 'suit'){
                              orderItemObject[x.split("/")[1].split("_")[0]] = 0.5
                              itemArray.push(x.split("/")[1].split("_")[0])
                            }else{
                              orderItemObject[x.split("/")[1].split("_")[0]] = 1
                              itemArray.push(x.split("/")[1].split("_")[0])
                            }
                          }
                        }
                      }
                      for (let x of orders["order_items"]) {
                        if (!itemArray.includes(x["item_name"])) {
                          remainingItemObject[x["item_name"]] = x.quantity;
                        }
                        if (x.quantity > orderItemObject[x["item_name"]]) {
                          remainingItemObject[x["item_name"]] =
                            x.quantity - orderItemObject[x["item_name"]];
                        }
                      }

                      return (
                        <tr>
                          <td>{orders["orderId"]}</td>
                          <td>{orders["customerName"]}</td>
                          <td>{orders["OrderDate"]}</td>
                          <td style={{ textTransform: "capitalize" }}>
                            {Object.keys(orderItemObject).map(
                              (items) =>
                                orderItemObject[items] + " " + items + " "
                            )}
                          </td>
                          <td>{Object.keys(remainingItemObject).length ? "Partial" : "Complete"}</td>
                          <td style={{ textTransform: "capitalize" }}>
                            {Object.keys(remainingItemObject).map(
                              (items) =>
                                remainingItemObject[items] + " " + items + " "
                            )}
                          </td>
                        </tr>
                      );
                    })
                  : ""}
              </tbody>
            </table>
          </div>
          <button type="button" className="custom-btn" onClick={PackagingPDF}>
            Pdf
          </button>
        </div>
      </Dialog>
      {success && (
        <Snackbar open={open1} autoHideDuration={2000} onClose={handleClose}>
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar open={open1} autoHideDuration={2000} onClose={handleClose}>
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
