import React, { useState, useContext, useEffect } from "react";
import { Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { axiosInstance } from "../../../../config";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import { useNavigate } from "react-router-dom";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import Jacket from "./../../../../images/JACKET.png";
import Jacket1 from "./../../../../images/JACKET-1.png";
import Jacket2 from "./../../../../images/JACKET-2.png";
import Jacket3 from "./../../../../images/JACKET-3.png";
import Pant from "./../../../../images/PAINT.png";
import Shirt from "./../../../../images/SHIRT.png";
import Shirt1 from "./../../../../images/SHIRT-1.png";
import Vest from "./../../../../images/vest_manual.png";
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import { createRef } from "react";
import * as htmlToImage from "html-to-image";

import Draggable from "react-draggable";
import { v4 as uuidv4 } from "uuid";



function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManualMeasurementsSize() {
  
  const { user } = useContext(Context);
  const location = useLocation();
  const orderPath = location.pathname.split("/")[3];  
  const customerPath = location.pathname.split("/")[4];
  const [jacketCount, setJacketCount] = useState(0);
  const [productsNameArray, setProductsNameArray] = useState([]);
  const [customer, setCustomer] = useState({});
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerMeasurements, setCustomerMeasurements] = useState({});
  const [open2, setOpen2] = useState(false);
  const [filledMeasurements, setFilledMeasurements] = useState([]);
  
  const [suitfilledMeasurement, setSuitFilledMeasurement] = useState([]);
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [customerData, setCustomerData] = useState([]);

  const [successMsg, setSuccessMsg] = useState(false)
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState(false)
  const [open6, setOpen6] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [editOrderButton, setEditOrderButton] = useState(false);

  //Suit State
  const [suitcustomerMeasurements, setSuitCustomerMeasurements] = useState({});
 

  const [isRushOrder, setIsRushOrder] = useState(false);

  // for manualSize 
  const [openManaul, setopenManaul] = useState(false);
  const [manualSizeFor, setManualSizeFor] = useState("");
  const [fittingType, setFittingType] = useState("");
  const [item, setItem] = useState("");
  const [items, setItems] = useState([]);
  const [manualSizeObject, setManualSizeObject] = useState({});
  const [productId, setProductId] = useState("");
  const [open7, setOpen7] = useState(false);
  const [suitProducts, setSuitProducts] = useState([])

  // for Tabs
  const [value, setValue] = React.useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };


  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
    };
    fetchProducts();

    const fetchUserMeasurements = async () => {

      const res1 = await axiosInstance.post("/groupOrders/fetchDatag/" + orderPath, { token: user.data.token });
      
      setOrders(res1.data.data[0]['order_items']);
      setOrderStatus(res1.data.data[0].order_status);
      const customerArray = res1.data.data[0]['customers'].filter((singleCus) => customerPath == singleCus['_id'])
      setCustomerData(customerArray[0]);


      if(res1.data.data[0]['order_status'] == "Rush"){
        setDate(res1.data.data[0]['rushOrderDate']);
        setIsRushOrder(true);
      }
      
      let num = 0

      for (let x of res1.data.data[0]['order_items']) {
        num += x['quantity'];
      }
     
      setJacketCount(num)

      // const res = await axiosInstance.post(
      //   "/userMeasurement/fetchCustomerByID/" + res1.data.data[0]['customer_id']['_id']
      // );

      setCustomer(customerArray[0]);

      for (let x of res1.data.data[0]['order_items']) {
        productsNameArray.push(x.item_name)
      }

      if (
        customerArray[0]["measurementsObject"] !== undefined &&
        customerArray[0]["measurementsObject"] !== null
      ) {
        if (Object.keys(customerArray[0]["measurementsObject"]).length > 0) {
            setCustomerMeasurements(customerArray[0]["measurementsObject"]);
            setFilledMeasurements(
              Object.keys(customerArray[0]["measurementsObject"])
            );
        }
      } else {
        console.log("null")
      }

      if (
        customerArray[0]["suit"] !== undefined &&
        customerArray[0]["suit"] !== null
      ) {
        if (Object.keys(customerArray[0]["suit"]).length > 0) {
          setSuitCustomerMeasurements(customerArray[0]["suit"]);
          setSuitFilledMeasurement("suit");
        }
      } else {
        console.log("null")
      }


      if (customerArray[0]["manualSize"] == null) {
        let object = {};
        for (let items of customerArray[0]["order_items"]) {
          if(items["item_name"] == "suit"){
            let suitObj ={}
            for (let x of Object.keys(customerArray[0]["suit"])){
              suitObj[x] = {};
            }
            object[items["item_name"]] = suitObj
          }else{
            object[items["item_name"]] = {};
          } 
        }
        setManualSizeObject(object);
      }else{
        setManualSizeObject(customerArray[0]["manualSize"])
      }

    };

    fetchUserMeasurements();
  }, [orderPath]);

  const newitem = () => {
    if (item.trim() !== "") {
        if (item == item.match(/^[\u0E00-\u0E7Fa-zA-Z']+$/) || item == item.match(/^[0-9]+$/)) {
        const newitem = {
          id: uuidv4(),
          item: item,
          color: '#e0e0df',
          defaultPos: { x: 100, y: 0 },
        };
        setItems((items) => [...items, newitem]);
        setItem("");
      } else {
        const gcd = function (a, b) {
          return !b ? a : gcd(b, a % b);
        }

        const toFraction = function (number) {
          const numberToArray = number.toString().split('.');
          const frcNum = numberToArray[0]
          let denominator, numerator;
          numerator = numberToArray[1]
          denominator = Math.pow(10, (numberToArray[1].length));
          const fractionGcd = gcd(denominator, numerator)
          return [Number(frcNum), (numerator / fractionGcd), (denominator / fractionGcd)];
        };

        const fractionVal = toFraction(item)

        const newitem = {
          id: uuidv4(),
          item: fractionVal,
          color: '#e0e0df',
          defaultPos: { x: 100, y: 0 },
        };
        setItems((items) => [...items, newitem]);
        setItem("");
      }


    } else {
      alert("Enter a item");
      setItem("");
    }
  };

  const keyPress = (event) => {
    var code = event.keyCode || event.which;
    if (code === 13) {
      newitem();
    }
  };


  const updatePos = (data, index) => {
    let newArr = [...items];
    newArr[index].defaultPos = { x: data.x, y: data.y };
    setItems(newArr);
  };

  const deleteNote = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };
console.log("manual size object ", manualSizeObject)
  
  // const handleDelete = async () => {
  //   const res = await axiosInstance.put(
  //     `/customerOrders/deleteProduct/${path}/${productId}`,
  //     { token: user.data.token }
  //   );
  //   if (res) {
  //     const res1 = await axiosInstance.post(
  //       "/customerOrders/fetchOrderByID/" + path,
  //       { token: user.data.token }
  //     );
  //     setOrders(res1.data.data[0]["order_items"]);
  //   }
  //   setOpen7(false);
  //   setOpen6(true);
  //   setSuccess(true);
  //   setSuccessMsg(res.data.message);
  // };



  const handleEditOrder = async (e) => {
    if (!user.data.retailer_code) {
      if (orderStatus === "New Order") {
        const res1 = await axiosInstance.put(
          "/userMeasurement/updateCustomerMeasurementsMeanualSize/" + customerPath,
          { manualSize: manualSizeObject, token: user.data.token }
        );     
        if (res1.data.status == true) {
          setOpen6(true);
          setSuccess(true);
          setSuccessMsg(res1.data.message);

          setTimeout(() => {
            navigate("/");
          }, 1000);
        } else {
          setOpen6(true);
          setError(true);
          setErrorMsg(res1.data.message);
        }
      } 
    } else {
      const res1 = await axiosInstance.put(
        "/userMeasurement/updateCustomerMeasurementsMeanualSize/" + customerPath,
        { manualSize: manualSizeObject, token: user.data.token }
      );
      if (res1.data.status == true) {
        setOpen6(true);
        setSuccess(true);
        setSuccessMsg(res1.data.message);

        setTimeout(() => {
          navigate("/");
        }, 1000);
      } else {
        setOpen6(true);
        setError(true);
        setErrorMsg(res1.data.message);
      }
    }
  };

  // fro manual size and delete
  const handleDeleteOpen = (id) => {
    setOpen7(true);
    setProductId(id);
  };

  const handleClose7 = () => {
    setOpen7(false);
  };

  const handleClose6 = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen6(false);
  };

  const handleCloseManual = () => {
    setopenManaul(false);
  };
  
  
  
  const handleOpenManual = (name) => {

    if(name == "suit"){

      const suits = Object.keys(suitcustomerMeasurements)
      
      setSuitProducts(suits)
      setManualSizeFor(name);
      setopenManaul(true);
    }else{
      // const type = Object.fromEntries(
      //   Object.entries(customerMeasurements[name])
      // ).fitting_type;
      // setFittingType(type);
      setManualSizeFor(name);
      setopenManaul(true);
    }
  };

  const handleManualSize = async (e) => {
    const { name, value } = e.target;
    manualSizeObject[manualSizeFor][name] = value;
    manualSizeObject[manualSizeFor]["fitting_type"] = fittingType;
    setManualSizeObject({ ...manualSizeObject });
  };

  const ref = createRef(null);

  const takeScreenShot = async (node) => {
    const dataURI = await htmlToImage.toPng(node);
    return dataURI;
  };

  
  const downloadSuitScreenshot = async(productName) => {
    setEditOrderButton(true)
    takeScreenShot(ref.current).then(async(image)=>{
      const a = document.createElement("a");
    a.href = image;
    const res = await axiosInstance.post("/image/uploadManualImage", {
      image: a.href,
    });
    const imageName = res.data.data['public_id'].split("/")[1] + "." + res.data.data['format']; 

    const addManualSizeObject = new Promise ((resolve, reject) => {
      try{ 
        manualSizeObject["suit"][productName]["imagePic"] = imageName;
        setManualSizeObject({ ...manualSizeObject });
        resolve()
      }catch(err){
        reject()
      }
    })

    addManualSizeObject.then(()=>{

      setEditOrderButton(false)
    });

    });
    setTimeout(() => {
      setItems([])
      setSuccessMsg("Successfully Done.")
    }, 500)
  }
  
  
  const downloadScreenshot = async(productName) => {
    setEditOrderButton(true)
    takeScreenShot(ref.current).then(async(image)=>{
      const a = document.createElement("a");
    a.href = image;
    const res = await axiosInstance.post("/image/uploadManualImage", {
      image: a.href,
    });
    console.log("res ", res)
    const imageName = res.data.data['public_id'].split("/")[1] + "." + res.data.data['format'];
          manualSizeObject[productName] = {imagePic: imageName};
        setManualSizeObject({ ...manualSizeObject }); 

    // const addManualSizeObject = new Promise ((resolve, reject) => {
    //    try{ 
    //     manualSizeObject[productName]["imagePic"] = imageName;
    //     setManualSizeObject({ ...manualSizeObject });
    //     resolve()
    //   }catch(err){
    //     reject()
    //   }
    // })

    // addManualSizeObject.then(()=>{

      setEditOrderButton(false)
    // });

    });
    setTimeout(() => {
      setItems([])
      setopenManaul(false);
    }, 500)
  }





const action = (
  <React.Fragment>
    <Button color="secondary" size="small" onClick={handleClose6}>
      UNDO
    </Button>
    <IconButton
      size="small"
      aria-label="close"
      color="inherit"
      onClick={handleClose6}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  </React.Fragment>
);


  return (

  <div className="step4_wrapper_NM">
   <div className="step-4rushorderbox">
        <div className="step4BOXED">
          <h3 className="steper-title">Total Product Information </h3>
          <p className="title-name-Short">
            <strong>
              {customerData !== undefined
                ? `${customerData.firstname} ${customerData.lastname}`
                : ""}
            </strong>
          </p>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>Manual Size</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {orders.length > 0 ? (
            orders.map((products, i) => {
              return (
                <tr key={i}>
                  <td>{products["item_name"].toUpperCase()}</td>
                  <td>
                    <span
                      onClick={() => handleOpenManual(products.item_name)}
                      style={{ color: "blue" }}
                    >
                      {(products.item_name).charAt(0).toUpperCase() + (products.item_name).slice(1)}
                    </span>
                  </td>
                  <td>
                    <Button
                      value={products.item_name}
                      data-name={products.item_name}
                      onClick={() => handleDeleteOpen(products._id)}
                      className="minusIc"
                    >
                      <DeleteIcon />
                    </Button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td style={{ color: "red" }}>Please select product here.....</td>
            </tr>
          )}

          <tr>
            <td className="undrLine"> </td>
            <td className="undrLine"> </td>
            <td className="undrLine"> </td>
            <td className="undrLine">
              <strong className="pl_20">Total =</strong>
            </td>
            <td className="text-center undrLine">
              <strong className="pl_20">{jacketCount}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="boxedTWo mt-15">
      <button type="button" disabled={editOrderButton} onClick={handleEditOrder} className="custom-btn">Edit Order</button>
      </div>
      <div>

      <Dialog
          onClose={handleCloseManual}
          open={openManaul}
          className="manaualSize_container"
        >
          <DialogTitle>
            Manual Size : <strong>{fittingType}</strong>
          </DialogTitle>
          <>
            <div>
              {manualSizeFor === "suit" ? (
                <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                  {suitProducts.length > 0 && suitProducts.map((pro, i)=> (
                    <Tab 
                      label={pro}
                      id ={`simple-tab-${i}`}
                      aria-controls = {`simple-tabpanel-${i}`}
                    />
                  ))}
                  </Tabs>
                </Box>
                {suitProducts.length > 0 && suitProducts.map((pro, j)=> (
                  <TabPanel value={value} index={j}>
                  <div>
                  {pro === "jacket" ? (
                    <>
                      <div className="n1Class">
                        <div id="new-item">
                          <input
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            placeholder="Enter something..."
                            onKeyPress={(e) => keyPress(e)}
                          />
                          <button onClick={newitem}>ENTER</button>
                        </div>
                        <div className="capture-image-container">
                          <div className="capture-image" ref={ref}>
                            <div id="items">
                              {items.map((item, index) => {
                                return (
                                  <Draggable
                                    key={item.id}
                                    defaultPosition={item.defaultPos}
                                    onStop={(e, data) => {
                                      updatePos(data, index);
                                    }}
                                  >
                                    <div
                                      style={{ backgroundColor: item.color }}
                                      className="box"
                                    >
                                      {typeof item.item === 'string' ?
                                        <p style={{ margin: 0 }}>{item.item}</p>
                                        :
                                        <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                      }
                                      <button
                                        id="delete"
                                        onClick={(e) => deleteNote(item.id)}
                                      >
                                        X
                                      </button>
                                    </div>
                                  </Draggable>
                                );
                              })}
                            </div>
                            <div className="custome_row">
                              <div className="col_14">
                                <div className="manaual_mesuring_card n1">
                                  <div className="leftBottomChenter">
                                    <p style={{ fontSize: "20px", fontWeight: 500 }}>
                                      อก =
                                    </p>
                                    <p style={{ fontSize: "20px", fontWeight: 500 }}>
                                      เอา =
                                    </p>
                                  </div>
    
                                  <img src={Jacket} className="img_fluid"></img>
                                  <input
                                    className="top_left manual_input-design"
                                    placeholder="type"
                                    // value={manualSizeObject[manualSizeFor]["input_one"]}
                                    // name="input_one"
                                    // onChange={handleManualSize}
                                  />
                                  <input
                                    className="right_top manual_input-design"
                                    placeholder="type"
                                    name="input_two"
                                    // value={manualSizeObject[manualSizeFor]["input_two"]}
                                    // onChange={handleManualSize}
                                  />
                                </div>
                              </div>
                              <div className="col_14">
                                <div className="manaual_mesuring_card n2">
                                  <img src={Jacket1} className="img_fluid"></img>
                                  <div className="compressed-layer">
                                    <p style={{ fontSize: "18px", fontWeight: 500 }}>
                                      อัดชั้น :
                                    </p>
                                    <select
                                      className="fitting-dropdown"
                                      name="dropdown_bottom"
                                      // value={
                                      //   manualSizeObject[manualSizeFor][
                                      //   "dropdown_bottom"
                                      //   ]
                                      // }
                                      // onChange={handleManualSize}
                                    >
                                      <option>-Select-</option>
                                      <option value="ชีฟอง">ชีฟอง</option>
                                      <option value="หนังไก่">หนังไก่</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <div className="col_14">
                                <div className="manaual_mesuring_card n3">
                                  <img src={Jacket2} className="img_fluid"></img>
                                </div>
                              </div>
                              <div className="col_14">
                                <div className="manaual_mesuring_card n4">
                                  <div className="shoulder-support">
                                    <p style={{ fontSize: "18px", fontWeight: 500 }}>
                                      หนุนไหล่ :
                                    </p>
                                    <select
                                      className="fitting-dropdown"
                                      name="dropdown_top"
                                      // value={
                                      //   manualSizeObject[manualSizeFor]["dropdown_top"]
                                      // }
                                      // onChange={handleManualSize}
                                    >
                                      <option>-Select-</option>
                                      <option value="บางมาก">บางมาก</option>
                                      <option value="กลาง">กลาง</option>
                                      <option value="เต็ม">เต็ม</option>
                                      <option value="ไม่ใส่">ไม่ใส่</option>
                                    </select>
                                  </div>
    
                                  <img src={Jacket3} className="img_fluid"></img>
                                  <input
                                    className="right_top manual_input-design"
                                    placeholder="type"
                                    name="input_three"
                                    // value={
                                    //   manualSizeObject[manualSizeFor]["input_three"]
                                    // }
                                    // onChange={handleManualSize}
                                  />
                                  <input
                                    className="manualinput manual_input-design"
                                    placeholder="type"
                                    name="input_four"
                                    // value={
                                    //   manualSizeObject[manualSizeFor]["input_four"]
                                    // }
                                    // onChange={handleManualSize}
                                  />
                                  <div className="tradesman">
                                    <p
                                      className="title"
                                      style={{ fontSize: "18px", fontWeight: 500 }}
                                    >
                                      ช่าง :
                                    </p>
                                    <select
                                      className="fitting-dropdown"
                                      name="dropdown_three"
                                      // value={
                                      //   manualSizeObject[manualSizeFor][
                                      //   "dropdown_three"
                                      //   ]
                                      // }
                                      // onChange={handleManualSize}
                                    >
                                      <option>-Select-</option>
                                      <option value="ลุง">ลุง</option>
                                      <option value="ควร">ควร</option>
                                      <option value="pattern + ควร">
                                        pattern + ควร
                                      </option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="boxedTWo mt-15">
                          <button
                            type="button"
                            className="custom-btn"
                            onClick={()=>downloadSuitScreenshot(pro)}
                          >
                            Jacket Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : pro === "pant" ? (
                    <>
                      <div className="n1Class">
                        <div id="new-item">
                          <input
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            placeholder="Enter something..."
                            onKeyPress={(e) => keyPress(e)}
                          />
                          <button onClick={newitem}>ENTER</button>
                        </div>
                        <div className="custome_row">
                          <div className="col_6 mx_auto">
                            <div className="manaual_mesuring_card" ref={ref}>
                              <div id="items">
                                {items.map((item, index) => {
                                  return (
                                    <Draggable
                                      key={item.id}
                                      defaultPosition={item.defaultPos}
                                      onStop={(e, data) => {
                                        updatePos(data, index);
                                      }}
                                    >
                                      <div
                                        style={{ backgroundColor: item.color }}
                                        className="box"
                                      >
                                        {typeof item.item === 'string' ?
                                          <p style={{ margin: 0 }}>{item.item}</p>
                                          :
                                          <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                        }
                                        <button
                                          id="delete"
                                          onClick={(e) => deleteNote(item.id)}
                                        >
                                          X
                                        </button>
                                      </div>
                                    </Draggable>
                                  );
                                })}
                              </div>
                              <img src={Pant} className="img_fluid"></img>
                              <input
                                className="manualinput manual_input-design"
                                placeholder="type"
                                name="input_one"
                                // value={manualSizeObject[manualSizeFor]["input_one"]}
                                // onChange={handleManualSize}
                              ></input>
                            </div>
                          </div>
                        </div>
                        <div className="boxedTWo mt-15">
                          <button
                            type="button"
                            className="custom-btn"
                            onClick={()=>downloadSuitScreenshot(pro)}
                          >
                            Pant Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <></>
                  )}

                  <button
                    type="button"
                    className="custom-btn"
                    onClick={()=>setopenManaul(false)}
                  >
                    Save
                  </button>
                  </div>
                </TabPanel>
                ))}
              </Box>
              ) : manualSizeFor === "jacket" ||
                  manualSizeFor === "longtail" ||
                  manualSizeFor === "overcoat" ? (
                <>
                  <div className="n1Class">
                    <div id="new-item">
                      <input
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="Enter something..."
                        onKeyPress={(e) => keyPress(e)}
                      />
                      <button onClick={newitem}>ENTER</button>
                    </div>
                    <div className="capture-image-container">
                      <div className="capture-image" ref={ref}>
                        <div id="items">
                          {items.map((item, index) => {
                            return (
                              <Draggable
                                key={item.id}
                                defaultPosition={item.defaultPos}
                                onStop={(e, data) => {
                                  updatePos(data, index);
                                }}
                              >
                                <div
                                  style={{ backgroundColor: item.color }}
                                  className="box"
                                >
                                  {typeof item.item === 'string' ?
                                    <p style={{ margin: 0 }}>{item.item}</p>
                                    :
                                    <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                  }
                                  <button
                                    id="delete"
                                    onClick={(e) => deleteNote(item.id)}
                                  >
                                    X
                                  </button>
                                </div>
                              </Draggable>
                            );
                          })}
                        </div>
                        <div className="custome_row">
                          <div className="col_14">
                            <div className="manaual_mesuring_card n1">
                              <div className="leftBottomChenter">
                                <p style={{ fontSize: "20px", fontWeight: 500 }}>
                                  อก =
                                </p>
                                <p style={{ fontSize: "20px", fontWeight: 500 }}>
                                  เอา =
                                </p>
                              </div>

                              <img src={Jacket} className="img_fluid"></img>
                              <input
                                className="top_left manual_input-design"
                                placeholder="type"
                                // value={manualSizeObject[manualSizeFor]["input_one"]}
                                // name="input_one"
                                // onChange={handleManualSize}
                              />
                              <input
                                className="right_top manual_input-design"
                                placeholder="type"
                                name="input_two"
                                // value={manualSizeObject[manualSizeFor]["input_two"]}
                                // onChange={handleManualSize}
                              />
                            </div>
                          </div>
                          <div className="col_14">
                            <div className="manaual_mesuring_card n2">
                              <img src={Jacket1} className="img_fluid"></img>
                              <div className="compressed-layer">
                                <p style={{ fontSize: "18px", fontWeight: 500 }}>
                                  อัดชั้น :
                                </p>
                                <select
                                  className="fitting-dropdown"
                                  name="dropdown_bottom"
                                  // value={
                                  //   manualSizeObject[manualSizeFor][
                                  //   "dropdown_bottom"
                                  //   ]
                                  // }
                                  // onChange={handleManualSize}
                                >
                                  <option>-Select-</option>
                                  <option value="ชีฟอง">ชีฟอง</option>
                                  <option value="หนังไก่">หนังไก่</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="col_14">
                            <div className="manaual_mesuring_card n3">
                              <img src={Jacket2} className="img_fluid"></img>
                            </div>
                          </div>
                          <div className="col_14">
                            <div className="manaual_mesuring_card n4">
                              <div className="shoulder-support">
                                <p style={{ fontSize: "18px", fontWeight: 500 }}>
                                  หนุนไหล่ :
                                </p>
                                <select
                                  className="fitting-dropdown"
                                  name="dropdown_top"
                                  // value={
                                  //   manualSizeObject[manualSizeFor]["dropdown_top"]
                                  // }
                                  // onChange={handleManualSize}
                                >
                                  <option>-Select-</option>
                                  <option value="บางมาก">บางมาก</option>
                                  <option value="กลาง">กลาง</option>
                                  <option value="เต็ม">เต็ม</option>
                                  <option value="ไม่ใส่">ไม่ใส่</option>
                                </select>
                              </div>

                              <img src={Jacket3} className="img_fluid"></img>
                              <input
                                className="right_top manual_input-design"
                                placeholder="type"
                                name="input_three"
                                // value={
                                //   manualSizeObject[manualSizeFor]["input_three"]
                                // }
                                // onChange={handleManualSize}
                              />
                              <input
                                className="manualinput manual_input-design"
                                placeholder="type"
                                name="input_four"
                                // value={
                                //   manualSizeObject[manualSizeFor]["input_four"]
                                // }
                                // onChange={handleManualSize}
                              />
                              <div className="tradesman">
                                <p
                                  className="title"
                                  style={{ fontSize: "18px", fontWeight: 500 }}
                                >
                                  ช่าง :
                                </p>
                                <select
                                  className="fitting-dropdown"
                                  name="dropdown_three"
                                  // value={
                                  //   manualSizeObject[manualSizeFor][
                                  //   "dropdown_three"
                                  //   ]
                                  // }
                                  // onChange={handleManualSize}
                                >
                                  <option>-Select-</option>
                                  <option value="ลุง">ลุง</option>
                                  <option value="ควร">ควร</option>
                                  <option value="pattern + ควร">
                                    pattern + ควร
                                  </option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="boxedTWo mt-15">
                      <button
                        type="button"
                        className="custom-btn"
                        onClick={()=>downloadScreenshot(manualSizeFor)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : manualSizeFor === "pant" ? (
                <>
                  <div className="n1Class">
                    <div id="new-item">
                      <input
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="Enter something..."
                        onKeyPress={(e) => keyPress(e)}
                      />
                      <button onClick={newitem}>ENTER</button>
                    </div>
                    <div className="custome_row">
                      <div className="col_6 mx_auto">
                        <div className="manaual_mesuring_card" ref={ref}>
                          <div id="items">
                            {items.map((item, index) => {
                              return (
                                <Draggable
                                  key={item.id}
                                  defaultPosition={item.defaultPos}
                                  onStop={(e, data) => {
                                    updatePos(data, index);
                                  }}
                                >
                                  <div
                                    style={{ backgroundColor: item.color }}
                                    className="box"
                                  >
                                    {typeof item.item === 'string' ?
                                      <p style={{ margin: 0 }}>{item.item}</p>
                                      :
                                      <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                    }
                                    <button
                                      id="delete"
                                      onClick={(e) => deleteNote(item.id)}
                                    >
                                      X
                                    </button>
                                  </div>
                                </Draggable>
                              );
                            })}
                          </div>
                          <img src={Pant} className="img_fluid"></img>
                          <input
                            className="manualinput manual_input-design"
                            placeholder="type"
                            name="input_one"
                            // value={manualSizeObject[manualSizeFor]["input_one"]}
                            // onChange={handleManualSize}
                          ></input>
                        </div>
                      </div>
                    </div>
                    <div className="boxedTWo mt-15">
                      <button
                        type="button"
                        className="custom-btn"
                        onClick={() => downloadScreenshot(manualSizeFor)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : manualSizeFor === "shirt" ? (
                <>
                  <div className="n1Class">
                    <div id="new-item">
                      <input
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="Enter something..."
                        onKeyPress={(e) => keyPress(e)}
                      />
                      <button onClick={newitem}>ENTER</button>
                    </div>
                    <div className="custome_row">
                      <div className="col_6 mx_auto">
                        <div className="manaual_mesuring_card" ref={ref}>
                          <div id="items">
                            {items.map((item, index) => {
                              return (
                                <Draggable
                                  key={item.id}
                                  defaultPosition={item.defaultPos}
                                  onStop={(e, data) => {
                                    updatePos(data, index);
                                  }}
                                >
                                  <div
                                    style={{ backgroundColor: item.color }}
                                    className="box"
                                  >
                                    {typeof item.item === 'string' ?
                                      <p style={{ margin: 0 }}>{item.item}</p>
                                      :
                                      <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                    }
                                    <button
                                      id="delete"
                                      onClick={(e) => deleteNote(item.id)}
                                    >
                                      X
                                    </button>
                                  </div>
                                </Draggable>
                              );
                            })}
                          </div>
                          <div className="shirt-fiitting-img">
                            <img src={Shirt} className="img_fluid"></img>
                            <img src={Shirt1} className="img_fluid"></img>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="boxedTWo mt-15">
                      <button
                        type="button"
                        className="custom-btn"
                        onClick={() => downloadScreenshot(manualSizeFor)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : manualSizeFor === "vest" ? (
                  <>
                    <div className="n1Class">
                      <div id="new-item">
                        <input
                          value={item}
                          onChange={(e) => setItem(e.target.value)}
                          placeholder="Enter something..."
                          onKeyPress={(e) => keyPress(e)}
                        />
                        <button onClick={newitem}>ENTER</button>
                      </div>
                      <div className="custome_row">
                        <div className="col_6 mx_auto">
                          <div className="manaual_mesuring_card" ref={ref}>
                            <div id="items">
                              {items.map((item, index) => {
                                return (
                                  <Draggable
                                    key={item.id}
                                    defaultPosition={item.defaultPos}
                                    onStop={(e, data) => {
                                      updatePos(data, index);
                                    }}
                                  >
                                    <div
                                      style={{ backgroundColor: item.color }}
                                      className="box"
                                    >
                                      {typeof item.item === 'string' ?
                                        <p style={{ margin: 0 }}>{item.item}</p>
                                        :
                                        <p style={{ margin: 0 }}>{item.item[0] !== 0 ? item.item[0] : ""}<sup>{item.item[1]}</sup>&frasl;<sub>{item.item[2]}</sub></p>
                                      }
                                      <button
                                        id="delete"
                                        onClick={(e) => deleteNote(item.id)}
                                      >
                                        X
                                      </button>
                                    </div>
                                  </Draggable>
                                );
                              })}
                            </div>
                            <div className="shirt-fiitting-img">
                              <img src={Vest} className="img_fluid"></img>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="boxedTWo mt-15">
                        <button
                          type="button"
                          className="custom-btn"
                          onClick={() => downloadScreenshot(manualSizeFor)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </>
              ) : (
                <></>
              )}
            </div>
          </>
        </Dialog>


      </div>
      <Dialog
        open={open7}
        onClose={handleClose7}
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
          <Button onClick={handleClose7}>Cancel</Button>
          <Button 
          // onClick={handleDelete} 
          autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
      {success && (
        <Snackbar
          open={open6}
          autoHideDuration={2000}
          onClose={handleClose6}
          action={action}
        >
          <Alert
            onClose={handleClose6}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar
          open={open6}
          autoHideDuration={2000}
          onClose={handleClose6}
          action={action}
        >
          <Alert onClose={handleClose6} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </div>
  );
}
