import React, { useState, useContext, useEffect } from "react";
import './editOrderWithManualSize.css';
import { Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { axiosInstance} from "../../../../config";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import MissingFabric from "./../../../FabricsAndStyling/MissingFabric";
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Measurements from "../../../Measurements/Measurements";
import SuitMeasurements from "../../../Measurements/SuitMeasurements";

import { createRef } from "react";
import * as htmlToImage from "html-to-image";

import Draggable from "react-draggable";
import { v4 as uuidv4 } from "uuid";
import TuxedoMeasurements from "../../../Measurements/TuxedoMeasurements";
var randomColor = require("randomcolor");


const missingMeasurementStyles = {
  color: "red",
  cursor: "pointer",
  fontWeight: 600
}

const completeMeasurementStyles = {
  color: "green",
  cursor: "pointer",
  fontWeight: 600
}


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

export default function EditOrderWithManualSize() {
  
  const { user } = useContext(Context);
  const location = useLocation();
  const path = location.pathname.split("/")[3];
  const [jacketCount, setJacketCount] = useState(0);
  const [productsNameArray, setProductsNameArray] = useState([]);
  const [open, setOpen] = useState(false);
  const [suitOpen, setSuitOpen] = useState(false);
  const [tuxedoOpen, setTuxedoOpen] = useState(false);
  const [customer, setCustomer] = useState({});
  const [orders, setOrders] = useState([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [products, setProducts] = useState([]);
  const [customerMeasurements, setCustomerMeasurements] = useState({});
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [suitfabricOpen, setSuitfabricOpen] = useState(false);
  const [customFittings, setCustomFittings] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [totalMeasurements, setTotalMeasurements] = useState("");
  const [productMeasurements, setProductMeasurements] = useState({});
  const [productMeasurements1, setProductMeasurements1] = useState([]);
  const [product_name, setProduct_name] = useState("");
  const [adjustmentValueImmutable, setAdjustmentValueImmutable] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isActive2, setIsActive2] = useState(false);
  const [isActive4, setIsActive4] = useState(false);
  const [filledMeasurements, setFilledMeasurements] = useState([]);
  const navigate = useNavigate();
  const [isMeasurementFilled, setIsMeasurementFilled] = useState(false);
  const [canPlaceOrder, setCanPlaceOrder] = useState(true);
  const [date, setDate] = useState("");
  const [customerData, setCustomerData] = useState([]);

  const [successMsg, setSuccessMsg] = useState(false)
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState(false)
  const [open6, setOpen6] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [editOrderButton, setEditOrderButton] = useState(false);
  const [draftMeasurementsObject, setDraftMeasurementsObject] = useState({})
  const [productFeaturesObject, setProductFeaturesObject] = useState({})

  //Suit State
  const [tuxedocustomerMeasurements, setTuxedoCustomerMeasurements] = useState({});
  const [suitcustomerMeasurements, setSuitCustomerMeasurements] = useState({});
  const [suitFilledMeasurements, setSuitFilledMeasurement] = useState([]);
  const [tuxedoFilledMeasurements, setTuxedoFilledMeasurement] = useState([]);
  const [newMeasurement, setNew] = useState([]);
  const [newTuxedoMeasurement, setNewTuxedoMeasurement] = useState([]);
  const [isActive3, setIsActive3] = useState(false);
 

  const [isRushOrder, setIsRushOrder] = useState(false);

  // for manualSize 
  const [openManual, setopenManual] = useState(false);
  const [manualSizeFor, setManualSizeFor] = useState("");
  const [fittingType, setFittingType] = useState("");
  const [item, setItem] = useState("");
  const [items, setItems] = useState([]);
  const [manualSizeObject, setManualSizeObject] = useState({});
  const [productId, setProductId] = useState("");
  const [open7, setOpen7] = useState(false);
  const [suitProducts, setSuitProducts] = useState([])
  const [tuxedoProducts, setTuxedoProducts] = useState([])
  const [measurementsFinished, setMeasurementsFinished] = useState({})

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
      const productObject = {}
      for(let x of res.data.data){
        const featureArray = []
        for(let y of x.features){
          if(y.additional == false){
            featureArray.push(y.name)
          }
        }
        productObject[x.name] = featureArray
  
      }
      setProductFeaturesObject(productObject)
      setProducts(res.data.data);
    };
    fetchProducts();

    const fetchUserMeasurements = async () => {

      const res1 = await axiosInstance.post("/customerOrders/fetchOrderByID/" + path, { token: user.data.token });
      
      setOrders(res1.data.data[0]['order_items']);
      setOrderStatus(res1.data.data[0].order_status);
      setCustomerData(res1.data.data[0]['customer_id']);

      if(res1.data.data[0]['order_status'] == "Rush"){
        setDate(res1.data.data[0]['rushOrderDate']);
        setIsRushOrder(true);
      }
      
      let num = 0

      for (let x of res1.data.data[0]['order_items']) {
        num += x['quantity'];
        measurementsFinished[x.item_name] = true
      }
      setMeasurementsFinished({...measurementsFinished})

      setJacketCount(num)

      const res = await axiosInstance.post(
        "/userMeasurement/fetchCustomerByID/" + res1.data.data[0]['customer_id']['_id']
      );

      setCustomer(res.data.data[0]);
      
      if (
        res.data.data[0]["measurementsObject"] !== undefined &&
        res.data.data[0]["measurementsObject"] !== null
      ) {
        if (Object.keys(res.data.data[0]["measurementsObject"]).length > 0) {
            setCustomerMeasurements(res.data.data[0]["measurementsObject"]);
            setFilledMeasurements(
              Object.keys(res.data.data[0]["measurementsObject"])
            );
        }
      } else {
        console.log("null")
      }
      console.log("ert: ", res.data.data[0]['tuxedo'])
      if (
        res.data.data[0]["suit"] !== undefined &&
        res.data.data[0]["suit"] !== null
      ) {
        if (Object.keys(res.data.data[0]["suit"]).length > 0) {
          setSuitCustomerMeasurements(res.data.data[0]["suit"]);
          setSuitFilledMeasurement("suit");
        }
      } else {
        console.log("null")
      }

      if(
        res.data.data[0]["tuxedo"] !== undefined &&
        res.data.data[0]["tuxedo"] !== null
      ){
        console.log("her hre hre")
        if (Object.keys(res.data.data[0]["tuxedo"]).length > 0) {
          setTuxedoCustomerMeasurements(res.data.data[0]["tuxedo"]);
          setTuxedoFilledMeasurement("tuxedo");
        }
      } else {
        console.log("null")
      }
      
    // const res2 = await axiosInstance.post("/draftMeasurements/fetch/" + res.data.data[0]['_id'], {token: user.data.token})
    // if(res.data.status == true){
    //   setDraftMeasurementsObject(res2.data.data[0]['measurementsObject'])
    // }

    let draftMeasurementsObj = {}
    if(res1.data.data[0].repeatOrder == true){
      const previousOrder = await axiosInstance.post("/customerOrders/fetchOrderByID/" + res1.data.data[0]['repeatOrderID'], {token : user.data.token})
      draftMeasurementsObj = previousOrder.data.data[0]['measurements']
      setDraftMeasurementsObject(draftMeasurementsObj)
    }else{
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + res1.data.data[0]['customer_id']['_id'], {token: user.data.token})
      if(existingOrders.data.status == true && existingOrders.data.data.length > 1){
        let ind = 0;
        let ourIndex ;
        for(let x of existingOrders.data.data){
          if(x['_id'] == path){
            ourIndex = ind
          }
          ind = ind + 1
        }
        console.log("existing orders: ", existingOrders.data.data)
        
        if(existingOrders.data.data[ourIndex - 1]){
          draftMeasurementsObj = existingOrders.data.data[ourIndex - 1]['measurements'] ? existingOrders.data.data[ourIndex - 1]['measurements'] : {}
        setDraftMeasurementsObject(draftMeasurementsObj)
        }
      }else if(existingOrders.data.status == true && existingOrders.data.data.length == 1){
        draftMeasurementsObj = existingOrders.data.data[0]['measurements'] ? existingOrders.data.data[0]['measurements'] : {}
        setDraftMeasurementsObject(draftMeasurementsObj)
      }
    }
      for (let x of res1.data.data[0]['order_items']) {
        productsNameArray.push(x.item_name)
      }

      // if (
      //   res.data.data[0]["measurementsObject"] !== undefined &&
      //   res.data.data[0]["measurementsObject"] !== null
      // ) {
      //   if (Object.keys(res.data.data[0]["measurementsObject"]).length > 0) {
      //       setCustomerMeasurements(res.data.data[0]["measurementsObject"]);
      //       setFilledMeasurements(
      //         Object.keys(res.data.data[0]["measurementsObject"])
      //       );
      //   }
      // } else {
      //   console.log("null")
      // }

      // if (
      //   res.data.data[0]["suit"] !== undefined &&
      //   res.data.data[0]["suit"] !== null
      // ) {
      //   if (Object.keys(res.data.data[0]["suit"]).length > 0) {
      //     setSuitCustomerMeasurements(res.data.data[0]["suit"]);
      //     setSuitFilledMeasurement("suit");
      //   }
      // } else {
      //   console.log("null")
      // }


      if (res1.data.data[0]["manualSize"] == null) {
        let object = {};
        for (let items of res1.data.data[0]["order_items"]) {
          if(items["item_name"] == "suit"){
            let suitObj ={}
            for (let x of Object.keys(res.data.data[0]["suit"])){
              suitObj[x] = {};
            }
            object[items["item_name"]] = suitObj
          }else if(items["item_name"] == "tuxedo"){
            let tuxedoObj ={}
            for (let x of Object.keys(res.data.data[0]["tuxedo"])){
              tuxedoObj[x] = {};
            }
            object[items["item_name"]] = tuxedoObj
          }else{
            object[items["item_name"]] = {};
          } 
        }
        setManualSizeObject(object);
      }else{
        setManualSizeObject(res1.data.data[0]["manualSize"])
      }

    };

    fetchUserMeasurements();
  }, [path]);

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

  // const handleDelete = async (e) => {
  //   let ordersObject = orders.filter((order) => {
  //     return order.item_name !== e.target.dataset.id;
  //   });

  //   let productsNameArrayFilter = productsNameArray.filter((product) => {
  //     setSuit("");
  //     return product !== e.target.dataset.name;
  //   });

  //   let filledMeasurementsArray = filledMeasurements.filter((product) => {
  //     return product !== e.target.dataset.name;
  //   });

  //   setFilledMeasurements(filledMeasurementsArray);

  //   setProductsNameArray(productsNameArrayFilter);

  //   setOrders(ordersObject);

  //   let totalCount = 0;

  //   if (!ordersObject.length > 0) {
  //     setJacketCount(0);
  //     setTotalQuantity(0);
  //   } else {
  //     for (let x of ordersObject) {
  //       totalCount = totalCount + x["quantity"];
  //       setJacketCount(totalCount);
  //       setTotalQuantity(totalCount);
  //     }
  //   }
  // };

  const handleDelete = async () => {
    const res = await axiosInstance.put(
      `/customerOrders/deleteProduct/${path}/${productId}`,
      { token: user.data.token }
    );
    if (res) {
      const res1 = await axiosInstance.post(
        "/customerOrders/fetchOrderByID/" + path,
        { token: user.data.token }
      );
      setOrders(res1.data.data[0]["order_items"]);
    }
    delete measurementsFinished[product_name]
    setMeasurementsFinished({...measurementsFinished})
    setOpen7(false);
    setOpen6(true);
    setSuccess(true);
    setSuccessMsg(res.data.message);
  };

  const handleManageMeasurement = async (e) => {

    const product = products.filter((pro) => {
      return pro.name == e.target.dataset.name;
    });
     
    if (customer['suit']) {

      for(let x of Object.keys(customer['suit'])) {
        if(x == e.target.dataset.name) {
          if(customer['suit'][e.target.dataset.name]?.["fitting_type"]){
            customerMeasurements[e.target.dataset.name]["fitting_type"] = customer['suit'][e.target.dataset.name]['fitting_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['suit'][e.target.dataset.name]?.['measurements']){
            customerMeasurements[e.target.dataset.name]["measurements"] = customer['suit'][e.target.dataset.name]['measurements']
            setProductMeasurements(customer['suit'][e.target.dataset.name]['measurements'])
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['suit'][e.target.dataset.name]?.["pant_type"]){
            customerMeasurements[e.target.dataset.name]["pant_type"] = customer['suit'][e.target.dataset.name]['pant_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['suit'][e.target.dataset.name]?.["shoulder_type"]){
              customerMeasurements[e.target.dataset.name]["shoulder_type"] = customer['suit'][e.target.dataset.name]['shoulder_type']
              setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['suit'][e.target.dataset.name]?.["notes"]){
            customerMeasurements[e.target.dataset.name]["notes"] = customer['suit'][e.target.dataset.name]['notes']
            setCustomerMeasurements({ ...customerMeasurements });
          }
        }else {
          setProductMeasurements(
            customerMeasurements[e.target.dataset.name]["measurements"]
          );
        }
      }
    }else if (customer['tuxedo']) {

      for(let x of Object.keys(customer['tuxedo'])) {
        if(x == e.target.dataset.name) {
          if(customer['tuxedo'][e.target.dataset.name]?.["fitting_type"]){
            customerMeasurements[e.target.dataset.name]["fitting_type"] = customer['tuxedo'][e.target.dataset.name]['fitting_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][e.target.dataset.name]?.['measurements']){
            customerMeasurements[e.target.dataset.name]["measurements"] = customer['tuxedo'][e.target.dataset.name]['measurements']
            setProductMeasurements(customer['tuxedo'][e.target.dataset.name]['measurements'])
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][e.target.dataset.name]?.["pant_type"]){
            customerMeasurements[e.target.dataset.name]["pant_type"] = customer['tuxedo'][e.target.dataset.name]['pant_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][e.target.dataset.name]?.["shoulder_type"]){
              customerMeasurements[e.target.dataset.name]["shoulder_type"] = customer['tuxedo'][e.target.dataset.name]['shoulder_type']
              setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][e.target.dataset.name]?.["notes"]){
            customerMeasurements[e.target.dataset.name]["notes"] = customer['tuxedo'][e.target.dataset.name]['notes']
            setCustomerMeasurements({ ...customerMeasurements });
          }
        }else {
          setProductMeasurements(
            customerMeasurements[e.target.dataset.name]["measurements"]
          );
        }
      }
    }else{
      setProductMeasurements(
        customerMeasurements[e.target.dataset.name]["measurements"]
      );
    }

    let check = "true";

    Object.keys(
      customerMeasurements[e.target.dataset.name]["measurements"]
    ).map((measurements) => {
      if (
        !customerMeasurements[e.target.dataset.name]["measurements"][
          measurements
        ]["total_value"] > 0
      ) {
        check = "false";
      }
    });
    if (check == "false") {
      setIsMeasurementFilled(false);
    } else {
      setIsMeasurementFilled(true);
    }

    const res = await axiosInstance.post(
      "/customFittings/fetch/" + product[0]["_id"],
      { token: user.data.token }
    );

    setCustomFittings(res.data.data);

    const res2 = await axiosInstance.post(
      "/product/fetchForMeasurements/" + product[0]["_id"],
      {
        token: user.data.token,
      }
    );

    setProduct_name(res2.data.data[0].name);

    setMeasurements(res2.data.data[0].measurements);

    setTotalMeasurements(res2.data.data[0].measurements.length);

    setIsActive(true);
    setOpen1(true);
   
  };

  const handleClose1 = async (e) => {
    setProduct_name("");
    setMeasurements([]);
    setOpen1(false);
  };

  const handleCloseSuit = async (e) => {
    setSuitOpen(false);
  };

  const handleCloseTuxedo = async (e) => {
    setTuxedoOpen(false);
  };

  const handleCustomFitValue = async (e) => {
    const fitMeasure = customFittings.filter((x) => {
      return x.fitting_name == e.target.value;
    });

    customerMeasurements[product_name]["fitting_type"] = e.target.value;

    setCustomerMeasurements({ ...customerMeasurements });

    if (e.target.value == "0") {

      setAdjustmentValueImmutable(false);

      for (let i = 0; i < Object.keys(productMeasurements).length; i++) {
        productMeasurements[
          Object.keys(productMeasurements)[i]
        ].adjustment_value = 0;
        productMeasurements[Object.keys(productMeasurements)[i]].total_value =
          Number(
            productMeasurements[Object.keys(productMeasurements)[i]].value
          ) +
          Number(
            productMeasurements[Object.keys(productMeasurements)[i]]
              .adjustment_value
          );
        setProductMeasurements({ ...productMeasurements });
      }
    } else {

      setAdjustmentValueImmutable(true);

      for (let x of fitMeasure[0].measurements) {
        if (Object.keys(x).length > 0) {
          productMeasurements[x.measurement_name].adjustment_value =
            x.fitting_value;
          productMeasurements[x.measurement_name].total_value =
            Number(x.fitting_value) +
            Number(productMeasurements[x.measurement_name].value);
          setProductMeasurements({ ...productMeasurements });
        } else {
          setProductMeasurements({});
        }
      }
    }
  };
  
  const handleOnClick = async (e) => {
    e.target.value = "";
  };

  const handleValueChange = async (e) => {
    let value = parseFloat(e.target.value);
    const string = e.target.name.split("-");
    if (string[1] == "value") {
      productMeasurements[string[0]]["total_value"] =
        productMeasurements[string[0]]["adjustment_value"] + value;
    } else if (string[1] == "adjustment_value") {
      productMeasurements[string[0]]["total_value"] =
        productMeasurements[string[0]]["value"] + value;
    }

    productMeasurements[string[0]][string[1]] = value;
    setProductMeasurements({ ...productMeasurements });
    customerMeasurements[product_name]["measurements"] = productMeasurements;
    setCustomerMeasurements({ ...customerMeasurements });
    let check = "true";
    Object.keys(productMeasurements).map((measurements) => {
      if (!productMeasurements[measurements]["total_value"] > 0) {
        check = "false";
      }
    });
    if (check == "false") {
      setIsMeasurementFilled(false);
    } else {
      setIsMeasurementFilled(true);
    }
  };

  const handleSaveMeasurements = async (e) => {
    
    if(product_name == 'jacket' || product_name == 'pant'){
      suitcustomerMeasurements[product_name] = customerMeasurements[product_name]
      setSuitCustomerMeasurements({...suitcustomerMeasurements})
      if(customer['suit']){
        customer['suit'][product_name] = customerMeasurements[product_name]
        setCustomer({...customer})
      }else{
        const obj = {}
        obj[product_name] = customerMeasurements[product_name]
        customer['suit'] = obj
      }
      if(product_name == 'pant'){
        tuxedocustomerMeasurements[product_name] = customerMeasurements[product_name]
        setTuxedoCustomerMeasurements({...tuxedocustomerMeasurements})
        if(customer['tuxedo']){
          customer['tuxedo'][product_name] = customerMeasurements[product_name]
          setCustomer({...customer})
        }else{
          const obj = {}
          obj[product_name] = customerMeasurements[product_name]
          customer['tuxedo'] = obj
        }
      }
    }

    setIsActive(false);
    console.log("customer measurements: ", customerMeasurements)
    console.log("product_name : ", product_name)
    const res = await axiosInstance.put(
      "/userMeasurement/updateCustomerMeasurementsSingle/" + customer['_id'],
      {
        measurements: { ...customerMeasurements},
        product: product_name
      }
    );

    customer["measurementsObject"] = customerMeasurements;
    setCustomer({ ...customer });

    setFilledMeasurements(Object.keys(res.data.data["measurementsObject"]));
    
    if(Object.keys(res.data.data["measurementsObject"]).includes('jacket') && Object.keys(res.data.data["measurementsObject"]).includes('pant')){
      measurementsFinished['suit'] = true
      setMeasurementsFinished({...measurementsFinished})
    }
    if(Object.keys(res.data.data["measurementsObject"]).includes('tuxedojacket') && Object.keys(res.data.data["measurementsObject"]).includes('pant')){
      measurementsFinished['tuxedo'] = true
      setMeasurementsFinished({...measurementsFinished})
    }
    measurementsFinished[product_name] = true
    setMeasurementsFinished({...measurementsFinished})

    if (
      orders.length == Object.keys(res.data.data["measurementsObject"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);
    setMeasurements([]);
    setProductMeasurements({});
    setProduct_name("");
  };


  // const handleEditOrder = async (e) => {
  //   const order = {
  //     order_items: orders,
  //     rushOrderDate: date,
  //     total_quantity: jacketCount,
  //     measurements:customerMeasurements,

  //   }

  //   const res1 = await axiosInstance.put("/customerOrders/updateOrder/" + path, { order: order, token: user.data.token });
  //   if (res1.data.status == true) {
  //     setOpen6(true)
  //     setSuccess(true)
  //     setSuccessMsg(res1.data.message);

  //     setTimeout(() => {
  //       navigate("/")
  //     }, 1000)

  //   } else {
  //     setOpen6(true)
  //     setError(true)
  //     setErrorMsg(res1.data.message)
  //   }

  // }

console.log("sdfds:", customerMeasurements)
console.log("sdasd:", suitcustomerMeasurements)
  const handleEditOrder = async (e) => {
    const order = {
      order_items: orders,
      total_quantity: jacketCount,
      measurements:customerMeasurements,
      Suitmeasurements: suitcustomerMeasurements
    };
    let order1 = {};
    console.log("sdajkdsa: ", customerData)
    // const res = await axiosInstance.put(
    //   "/userMeasurement/updateCustomerMeasurementsNewUpdate/" +
    //   customerData._id,
    //   // customerData.measurementsObject,
    //   { 
    //     customer:customerData,
    //     token: user.data.token 
    //   }
    // );
    // if (!user.data.retailer_code) {
      if (orderStatus === "New Order") {
        order1 = {
          order_items: orders,
          order_status: "Modified",
          manualSize: manualSizeObject,
          total_quantity: jacketCount,
          measurements:customerMeasurements,
          Suitmeasurements: suitcustomerMeasurements
        };
      } else if (orderStatus === "Modified") {
        order1 = {
          order_items: orders,
          order_status: "Modified",
          total_quantity: jacketCount,
          manualSize: manualSizeObject,
          measurements:customerMeasurements,
          Suitmeasurements: suitcustomerMeasurements
        };
      } else if (orderStatus === "Processing") {
        order1 = {
          order_items: orders,
          order_status: "Processing",
          total_quantity: jacketCount,
          measurements:customerMeasurements,
          Suitmeasurements: suitcustomerMeasurements
        };
      } else if (orderStatus === "Rush") {
        order1 = {
          order_items: orders,
          order_status: "Modified",
          manualSize: manualSizeObject,
          total_quantity: jacketCount,
          measurements:customerMeasurements,
          Suitmeasurements: suitcustomerMeasurements
        };
      }
    if (orders.length > 0 && orders.length !== null && !Object.values(measurementsFinished).includes(false)) {

      const res1 = await axiosInstance.put(
        "/customerOrders/updateOrderWithStatusCode/" + path,
        { order: order1, token: user.data.token }
      );
      if (res1.data.status == true) {
        const pdfString =  exportPDF(res1.data.data['_id'])
        navigate("/");       
      } else {
        setOpen6(true);
        setError(true);
        setErrorMsg(res1.data.message);
      }
    }else{
      setErrorMsg("Please Complete the necesaary information!")
      setSuccess(false)
      setError(true)
    }
    // } else {
    //   const res1 = await axiosInstance.put(
    //     "/customerOrders/updateOrder/" + path,
    //     { order: order, token: user.data.token }
    //   );
    //   if (res1.data.status == true) {
    //     setOpen6(true);
    //     setSuccess(true);
    //     setSuccessMsg(res1.data.message);

    //     setTimeout(() => {
    //       navigate("/");
    //     }, 1000);
    //   } else {
    //     setOpen6(true);
    //     setError(true);
    //     setErrorMsg(res1.data.message);
    //   }
    // }
  };


  // saving pdf function========================
  // ===========================================

  const exportPDF = async (order) => {

    let orderItemsArrayPDF = [];

    let justAnArray = [];

    const res = await axiosInstance.post(
      "/customerOrders/fetchOrderByID/" + order,
      { token: user.data.token }
    );

    const res1 = await axiosInstance.post('/retailer/fetch', {
      token: user.data.token,
      id: res.data.data[0]['retailer_id']
    })

    // fetch draft measurements=====================
    // console.log(res.data)
    // const res2 = await axiosInstance.post("/draftMeasurements/fetch/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
    // console.log(res2.data)
    let draftMeasurementsObj = {}
    if(res.data.data[0].repeatOrder == true){
      const previousOrder = await axiosInstance.post("/customerOrders/fetchOrderByID/" + res.data.data[0]['repeatOrderID'], {token : user.data.token})
      draftMeasurementsObj = previousOrder.data.data[0]['measurements']
    }else{
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
      
  if(existingOrders.data.status == true && existingOrders.data.data.length > 1){
        let ind = 0;
        let ourIndex ;
        for(let x of existingOrders.data.data){
          if(x['_id'] == path){
            ourIndex = ind
          }
          ind = ind + 1
        }
        if(existingOrders.data.data[ourIndex - 1]){
          draftMeasurementsObj = existingOrders.data.data[ourIndex - 1]['measurements'] ? existingOrders.data.data[ourIndex - 1]['measurements'] : {}
        setDraftMeasurementsObject(draftMeasurementsObj)
        }
      }else if(existingOrders.data.status == true && existingOrders.data.data.length == 1){
        draftMeasurementsObj = existingOrders.data.data[0]['measurements'] ? existingOrders.data.data[0]['measurements'] : {}
          setDraftMeasurementsObject(draftMeasurementsObj)
      }
    }
  
    var retailerObject = res1.data.data[0]

    let orderItemsArray = [];
    for (let m of res.data.data[0]["order_items"]) {
      if (m.item_name == "suit") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "jacket " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          let itemsObject2 = {
            item_name: m["item_name"],
            item_code: "pant " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          orderItemsArray.push(itemsObject1);          
          orderItemsArray.push(itemsObject2);
        }
      } else if (m.item_name == "tuxedo") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "tuxedojacket " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          let itemsObject2 = {
            item_name: m["item_name"],
            item_code: "pant " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          orderItemsArray.push(itemsObject1);          
          orderItemsArray.push(itemsObject2);
        }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          orderItemsArray.push(itemsObject);
        }
      }
    }

    let j = 1;

    for (let m of res.data.data[0]["order_items"]) {
      if (m.item_name == "suit") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "jacket " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject1);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject1);
          }

          j = j + 1;

          let itemsObject2 = {
            item_name: m["item_name"],
            item_code:  "pant " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject2);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject2);
          }

          j = j + 1;
        }
      } else if (m.item_name == "tuxedo") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject1 = {
            item_name: m["item_name"],
            item_code: "tuxedojacket " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject1);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject1);
          }

          j = j + 1;

          let itemsObject2 = {
            item_name: m["item_name"],
            item_code:  "pant " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };

          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject2);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject2);
          }

          j = j + 1;
        }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            repeatOrder: res.data.data[0]["repeatOrder"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
          };
          if (j % 5 == 0 || orderItemsArray.length == j) {
            justAnArray.push(itemsObject);
            orderItemsArrayPDF.push(justAnArray);
            justAnArray = [];
          } else {
            justAnArray.push(itemsObject);
          }

          j = j + 1;
        }
      }
     
    }

    let singleOrderArray = [];
    for (let m of res.data.data[0]["order_items"]) {
      if (m.item_name == "suit") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {

          let itemsObject1 = {
             item_name: m["item_name"], 
             item_code: "jacket " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Suitmeasurements['jacket'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize['jacket']
               ),
           };

           let itemsObject2 = {
             item_name: m["item_name"],
             item_code: "pant " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Suitmeasurements['pant'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize['pant']
               ),
           };
           
           singleOrderArray.push(itemsObject1);
           
           singleOrderArray.push(itemsObject2);

       }
      } else if (m.item_name == "tuxedo") {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {

          let itemsObject1 = {
             item_name: m["item_name"], 
             item_code: "tuxedojacket " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Tuxedomeasurements['tuxedojacket'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize['tuxedojacket']
               ),
           };

           let itemsObject2 = {
             item_name: m["item_name"],
             item_code: "pant " + n,
             quantity: m["quantity"],
             styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
             measurementsObject: res.data.data[0].Tuxedomeasurements['pant'],
             manualSize:
               res.data.data[0].manualSize == null ? (
                 <></>
               ) : (
                 res.data.data[0].manualSize['pant']
               ),
           };
           
           singleOrderArray.push(itemsObject1);
           
           singleOrderArray.push(itemsObject2);

       }
      } else {
        for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
          let itemsObject = {
            item_name: m["item_name"],
            item_code: m["item_name"] + " " + n,
            quantity: m["quantity"],
            styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
            measurementsObject: res.data.data[0].measurements[m["item_name"]],
            manualSize:
              res.data.data[0].manualSize == null ? (
                <></>
              ) : (
                res.data.data[0].manualSize[m["item_name"]]
              ),
          };
          singleOrderArray.push(itemsObject);
        }
      }
    }
    console.log("sing: ", singleOrderArray)
    const orderItemsArrayPDFString = JSON.stringify(orderItemsArrayPDF)
    const singleOrderArrayString = JSON.stringify(singleOrderArray)

    const productFeaturesObjectString = JSON.stringify(productFeaturesObject)
    
    const draftMeasurementsObjString = JSON.stringify(draftMeasurementsObj)

    console.log("single: ", singleOrderArray)

    const pdfString = await axiosInstance.post('customerOrders/createPdf', {
      token: user.data.token,
      productFeaturesObject: productFeaturesObjectString,
      draftMeasurementsObj: draftMeasurementsObjString,
      orderItemsArray: orderItemsArrayPDFString,
      singleOrderArray: singleOrderArrayString,
      order: JSON.stringify(res.data.data[0]),
      retailer: JSON.stringify(res1.data.data[0])
    })

    if(pdfString.data.status == true){
      const sendMail = await axiosInstance.post('customerOrders/sendMail', {
        token: user.data.token,
        order: res.data.data[0]['orderId']
      })
      console.log('done')
    }
    
  };

  // ===========================================
  // ===========================================

  const handleChangeType = async (e) => {
    if (product_name == "pant") {
      customerMeasurements[product_name]["pant_type"] = e.target.value;
      setCustomerMeasurements({ ...customerMeasurements });
    } else {
      customerMeasurements[product_name]["shoulder_type"] = e.target.value;
      setCustomerMeasurements({ ...customerMeasurements });
    }
  };

  const handleNoteChange = async (e) => {
    customerMeasurements[product_name]["notes"] = e.target.value;
    setCustomerMeasurements({ ...customerMeasurements });
  };

  const handleStyleDataSave = async (e) => {    
    setIsActive2(false);
    setOpen2(false);
  };

  const handleManageStyle = async (e) => {
    setProduct_name(e.target.dataset.name);
    setIsActive2(true);
    setOpen2(true);
  };

  const handleClose2 = async (e) => {
    setOpen2(false);
  };

  // fro manual size and delete
  const handleDeleteOpen = (id, name) => {
    setProduct_name(name)
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
    setopenManual(false);
  };
  
  
  const handleOpenManual = (name) => {
    console.log("name: ", name)
    if(name == "suit"){
      const suits = Object.keys(suitcustomerMeasurements)
      
      setSuitProducts(suits)
      // const type = Object.fromEntries(
      //   Object.entries(suitcustomerMeasurements[name])
      // ).fitting_type;
      // setFittingType(type);
      setManualSizeFor(name);
      setopenManual(true);
    } else if(name == "tuxedo"){
      console.log("going in here")
      const tuxedos = Object.keys(tuxedocustomerMeasurements)
      
      // setSuitProducts(suits)
      setTuxedoProducts(tuxedos)
      // const type = Object.fromEntries(
      //   Object.entries(suitcustomerMeasurements[name])
      // ).fitting_type;
      // setFittingType(type);
      setManualSizeFor(name);
      setopenManual(true);
    }else{
      const type = Object.fromEntries(
        Object.entries(customerMeasurements[name])
      ).fitting_type;
      setFittingType(type);
      setManualSizeFor(name);
      setopenManual(true);
    }
  };
  console.log("products: ", tuxedoProducts)
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

  // const download = async (image, { name = "img", extension = "png" } = {}) => {
  //   const a = document.createElement("a");
  //   a.href = image;
  //   const res = await axiosInstance.post("/image/uploadManualImage", {
  //     image: a.href,
  //   });

  //   manualSizeObject[manualSizeFor]["imagePic"] = res.data.data;
  //   setManualSizeObject({ ...manualSizeObject });
  // };
  
  const downloadSuitScreenshot = async(productName) => {
    setEditOrderButton(true)
    takeScreenShot(ref.current).then(async(image)=>{
    const a = document.createElement("a");
    a.href = image;
    const res = await axiosInstance.post("/image/uploadManualImage", {
      image: a.href,
    });

    const addManualSizeObject = new Promise ((resolve, reject) => {
      try{ 
       if(manualSizeObject[productName]){
             manualSizeObject[productName]["imagePic"] = res.data.data;
             setManualSizeObject({ ...manualSizeObject });
           }else{
             const obj = {}
             obj['imagePic'] = res.data.data;
             manualSizeObject[productName] = obj;
             setManualSizeObject({ ...manualSizeObject });
           }
       resolve()
     }catch(err){
       reject()
     }
   })

   if(res.data.status == true){
    addManualSizeObject.then(()=>{
      setEditOrderButton(false)
    });
   }
    });
    setTimeout(() => {
      setItems([])
      setSuccessMsg("Successfully Done.")
    }, 500)
  }

  const downloadTuxedoScreenshot = async(productName) => {
    setEditOrderButton(true)
    takeScreenShot(ref.current).then(async(image)=>{
    const a = document.createElement("a");
    a.href = image;
    const res = await axiosInstance.post("/image/uploadManualImage", {
      image: a.href,
    });

    const addManualSizeObject = new Promise ((resolve, reject) => {
      try{ 
       if(manualSizeObject[productName]){
             manualSizeObject[productName]["imagePic"] = res.data.data;
             setManualSizeObject({ ...manualSizeObject });
           }else{
             const obj = {}
             obj['imagePic'] = res.data.data;
             manualSizeObject[productName] = obj;
             setManualSizeObject({ ...manualSizeObject });
           }
       resolve()
     }catch(err){
       reject()
     }
   })

   if(res.data.status == true){
    addManualSizeObject.then(()=>{
      setEditOrderButton(false)
    });
   }
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
    
    const addManualSizeObject = new Promise ((resolve, reject) => {
       try{ 
        if(manualSizeObject[productName]){
          manualSizeObject[productName]["imagePic"] = res.data.data;
          setManualSizeObject({ ...manualSizeObject });
          resolve()
        }else{
          const obj = {}
          obj['imagePic'] = res.data.data;
          manualSizeObject[productName] = obj;
          setManualSizeObject({ ...manualSizeObject });
          resolve()
        }
      }catch(err){
        console.log("shjh",err.message)
        reject()
      }
    })
    if(res.data.status == true){      
      addManualSizeObject.then(()=>{
        setEditOrderButton(false)
      });
    }
 

    });
    setTimeout(() => {
      setItems([])
      setopenManual(false);
    }, 500)
}

console.log("manual: ", manualSizeObject)


//------------- SUIT Mesurement --------------------//

  const handleSuitMeasurement = async (e) => {
    for (let x of Object.keys(suitcustomerMeasurements)) {
      const product = products.filter((pro) => {
        return pro.name == x;
      });

      if(customer["measurementsObject"]){

        if(Object.keys(customer['measurementsObject']).includes('pant') == true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            suitcustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            suitcustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["pant_type"]) {
            suitcustomerMeasurements[x]["pant_type"] = customer['measurementsObject'][x]['pant_type']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            suitcustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
        }
        if(Object.keys(customer['measurementsObject']).includes('jacket')== true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            suitcustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            suitcustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["shoulder_type"]) {
            suitcustomerMeasurements[x]["shoulder_type"] = customer['measurementsObject'][x]['shoulder_type']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            suitcustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
          }
        }

      }else{
        setProductMeasurements1(suitcustomerMeasurements[x]["measurements"])
      }

      let check = "true";

      Object.keys(suitcustomerMeasurements[x]["measurements"]).map(
        (measurements) => {
          if (
            !suitcustomerMeasurements[x]["measurements"][measurements][
              "total_value"
            ] > 0
          ) {
            check = "false";
          }
        }
      );
      if (check == "false") {
        setIsMeasurementFilled(false);
      } else {
        setIsMeasurementFilled(true);
      }

      for (let i = 0; i < product.length; i++) {
        let res = await axiosInstance.post(
          "/customFittings/fetch/" + product[i]._id,
          { token: user.data.token }
        );

        newMeasurement.push({
          name: product[i].name,
          measurements: product[i].measurements,
          custom: res.data.data,
          m: suitcustomerMeasurements[x]["measurements"],
        });
      }

      setNew([...newMeasurement]);
    }

    setIsActive3(true);
    setSuitOpen(true);
  };

  const handleSuitfabricClose2 = async (e) => {
    setSuitfabricOpen(false);
  };

  const suitSave = async (e) => {
    setIsActive3(false);

    const res = await axiosInstance.put(
      "/userMeasurement/updatesuitCustomerMeasurements/" + customer['_id'],
      {
        measurements: { ...suitcustomerMeasurements },
      }
    );

    customer["suit"] = { ...suitcustomerMeasurements };
    setCustomer({ ...customer });

    if (
      orders.length == Object.keys(res.data.data["suit"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);

    setSuitFilledMeasurement('suit');

    if (
      orders.length == Object.keys(res.data.data["suit"]).length
    ) {
      setCanPlaceOrder(true);
    }

    setSuitOpen(false);
    setNew([]);
  };

  const suithandleValueChange = async (e) => {
    let value = parseFloat(e.target.value);
    let string = e.target.name.split("-");
    if (string[1] === "value") {
      for (let x of newMeasurement) {
        for (let y of Object.keys(x.m)) {
          if (y === string[0]) {
            x.m[string[0]]["total_value"] =
              x.m[string[0]]["adjustment_value"] + value;
          }
        }
      }
    } else if (string[1] === "adjustment_value") {
      for (let x of newMeasurement) {
        for (let y of Object.keys(x.m)) {
          if (y === string[0]) {
            x.m[string[0]]["total_value"] = x.m[string[0]]["value"] + value;
          }
        }
      }
    }

    for (let z of newMeasurement) {
      for (let u of Object.keys(z.m)) {
        if (u === string[0]) z.m[string[0]][string[1]] = value;
      }
    }

    for (let u of newMeasurement) {
      suitcustomerMeasurements[u.name]["measurements"] = u.m;
    }
    setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
    setNew([...newMeasurement]);
  };

  const handleSuitCustomFitValue = async (name, e) => {
    let arr = [];

    for (let y of newMeasurement) {
      for (let z of y.custom) {
        if (z.fitting_name === e.target.value) {
          arr.push(z);
          for (let x of Object.keys(suitcustomerMeasurements)) {
            if (x == y.name) {
              suitcustomerMeasurements[x]["fitting_type"] = e.target.value;
            }
          }
        }
      }
    }
    const fitMeasure = arr.filter((x) => {
      return x.fitting_name == e.target.value;
    });

    setSuitCustomerMeasurements({ ...suitcustomerMeasurements });

    if (e.target.value == "0") {
      setAdjustmentValueImmutable(false);

      for (let y of newMeasurement) {
        if (y.name === name) {
          for (let m of Object.keys(y.m)) {
            y.m[m]["adjustment_value"] = 0;
            y.m[m]["total_value"] =
              Number(y.m[m].value) + Number(y.m[m].adjustment_value);
          }
        }
      }
    } else {
      setAdjustmentValueImmutable(true);

      for (let x of fitMeasure[0].measurements) {
        for (let m of newMeasurement) {
          for (let y of Object.keys(m.m)) {
            if (y == x.measurement_name) {
              m.m[x.measurement_name]["adjustment_value"] = x.fitting_value;
              m.m[x.measurement_name]["total_value"] =
                Number(x.fitting_value) + Number(m.m[x.measurement_name].value);
            }
          }
        }
      }
    }
  };

  const handleSuitNoteChange = async (name, e) => {
    for (let y of newMeasurement) {
      if (y.name === name) {
        for (let x of Object.keys(suitcustomerMeasurements)) {
          if (x == y.name) {
            suitcustomerMeasurements[x]["notes"] = e.target.value;
          }
        }
      }
    }

    setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
  };

  const handleSuitTypeChangeType = async (name, e) => {
    if (name === "pant") {
      for (let y of newMeasurement) {
        if (y.name === name) {
          for (let x of Object.keys(suitcustomerMeasurements)) {
            if (x == y.name) {
              suitcustomerMeasurements[x]["pant_type"] = e.target.value;
              setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
            }
          }
        }
      }
    } else {
      for (let y of newMeasurement) {
        if (y.name === name) {
          for (let x of Object.keys(suitcustomerMeasurements)) {
            if (x == y.name) {
              suitcustomerMeasurements[x]["shoulder_type"] = e.target.value;
              setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
            }
          }
        }
      }
    }
  };

  const handleSuitManageStyle = async (e) => {
    setProduct_name(e.target.dataset.name);
    setIsActive4(true);
    setSuitfabricOpen(true);
  };

  const handleSuitStyleDataSave = async (e) => {
    setIsActive4(false);
    setSuitfabricOpen(false);
  };


//------------- END --------------------//

//------------- TUXEDO Mesurement --------------------//

  const handleTuxedoMeasurements = async (e) => {
    for (let x of Object.keys(tuxedocustomerMeasurements)) {
      const product = products.filter((pro) => {
        return pro.name == x;
      });

      if(customer["measurementsObject"]){


        if(Object.keys(customer['measurementsObject']).includes('pant') == true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            tuxedocustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            tuxedocustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["pant_type"]) {
            tuxedocustomerMeasurements[x]["pant_type"] = customer['measurementsObject'][x]['pant_type']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            tuxedocustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
        }
        if(Object.keys(customer['measurementsObject']).includes('tuxedojacket')== true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            tuxedocustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            tuxedocustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["shoulder_type"]) {
            tuxedocustomerMeasurements[x]["shoulder_type"] = customer['measurementsObject'][x]['shoulder_type']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            tuxedocustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
        }

      }else{
        setProductMeasurements1(tuxedocustomerMeasurements[x]["measurements"])
      }

      let check = "true";

      Object.keys(tuxedocustomerMeasurements[x]["measurements"]).map(
        (measurements) => {
          if (
            !tuxedocustomerMeasurements[x]["measurements"][measurements][
              "total_value"
            ] > 0
          ) {
            check = "false";
          }
        }
      );
      if (check == "false") {
        setIsMeasurementFilled(false);
      } else {
        setIsMeasurementFilled(true);
      }

      for (let i = 0; i < product.length; i++) {
        let res = await axiosInstance.post(
          "/customFittings/fetch/" + product[i]._id,
          { token: user.data.token }
        );

        newTuxedoMeasurement.push({
          name: product[i].name,
          measurements: product[i].measurements,
          custom: res.data.data,
          m: tuxedocustomerMeasurements[x]["measurements"],
        });
      }

      setNewTuxedoMeasurement([...newTuxedoMeasurement]);
    }
    setProduct_name('tuxedo')
    setIsActive4(true);
    setTuxedoOpen(true);
  };
  const tuxedoSave = async (e) => {
    setIsActive4(false);

    const res = await axiosInstance.put(
      "/userMeasurement/updateTuxedoCustomerMeasurements/" + path,
      {
        measurements: { ...tuxedocustomerMeasurements },
      }
    );

    customer["tuxedo"] = { ...tuxedocustomerMeasurements } ;
    setCustomer({ ...customer });

    if (res.data.data["tuxedo"] &&
      orders.length == Object.keys(res.data.data["tuxedo"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);

    setTuxedoFilledMeasurement('tuxedo');

    measurementsFinished['tuxedo'] = true
    setMeasurementsFinished({...measurementsFinished})

    setTuxedoOpen(false);
    setNewTuxedoMeasurement([]);
  };


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
      {/* <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        className="rushmain"
        >
        <DialogTitle id="alert-dialog-title" className="dialog-title-head">
          Rush Order
        </DialogTitle>
        <DialogContent>
          <div className="searchinput-inner">
            <p> Date </p>
            <input
              type="date"
              className="searchinput"
              onChange={handleChageDate}
              value={date}
            />
          </div>
          <div className="append-inputs-btn">
            <input
              type="submit"
              className="custom-btn"
              onClick={saveDate}
              value="Save"
            />
          </div>
        </DialogContent>
      </Dialog> */}


      {/* <div className="searchinput-inner">
        <p>
          Product <span className="red-required">*</span>
        </p>
        <select className="searchinput" onChange={handleProduct}>
          {productsNameArray.length > 0 ? (
            <option style={{ backgroundColor: "#62626b", color: "#fff" }}>
             Select
            </option>
          ) : (
            <option>Select a Product</option>
          )}

          {productsNameArray.includes("suit") ? "" : <option value={"suit"}>
            Suit
          </option>}
          {products.map((product, i) => {
            if (!productsNameArray.includes(product.name)) {
                return (
                  <option key={i} value={product._id} data-name={product.name} >
                    {product.name.charAt(0).toUpperCase() + product.name.slice(1)}
                  </option>
                );
             
            }
          })}
        </select>
      </div> */}

      <table className="table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>Measurement</th>
            <th>fabric & styling</th>
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
                      value={products.item_name}
                      data-name={products.item_name}
                      onClick={
                        products.item_name === "suit"
                          ? handleSuitMeasurement 
                          :
                          products.item_name === "tuxedo" 
                          ?
                          handleTuxedoMeasurements
                          : 
                          handleManageMeasurement
                      }
                      style={filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name) || tuxedoFilledMeasurements.includes(products.item_name)
                        ? completeMeasurementStyles
                        : missingMeasurementStyles}
                    >
                      {filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name) || tuxedoFilledMeasurements.includes(products.item_name)
                        ? "Complete"
                        : "Missing"}
                    </span>
                  </td>
                  <td className="styleFabricsTD">
                    <span
                      value={products.item_name}
                      data-name={products.item_name}
                      onClick={
                        products["quantity"] > 0 
                          ? handleManageStyle
                          : handleOnClick
                      }
                      style={products["styles"] &&
                      Object.keys(products["styles"]).length > 0
                        ? completeMeasurementStyles
                        : missingMeasurementStyles}
                    >
                      {products["styles"] &&
                      Object.keys(products["styles"]).length > 0
                        ? "Complete"
                        : "Missing"}
                    </span>
                  </td>
                  {/* <td>
                    <Button
                      className="minusIc"
                      data-name={products["item_name"]}
                      data-id={products.item_name}
                      onClick={DecNum}
                      disabled={
                        (products["styles"] &&
                          Object.keys(products["styles"]).length ==
                            products["quantity"]) ||
                        products["quantity"] == 1
                          ? true
                          : false
                      }
                    >
                      -
                    </Button>
                    <span className="countOutput" name={products}>
                      {products["quantity"]}
                    </span>
                    <Button
                      className="plusIc"
                      data-name={products["item_name"]}
                      value={products["quantity"]}
                      data-id={products.item_name}
                      onClick={IncNum}
                    >
                      +
                    </Button>
                  </td> */}
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
                      onClick={() => handleDeleteOpen(products._id, products.item_name)}
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
      <button type="button" disabled={editOrderButton} onClick={handleEditOrder} className={editOrderButton ? "custom-btn-disabled" : "custom-btn"}>Save Order</button>
      </div>
      <div>

        <Dialog
          onClose={handleCloseManual}
          open={openManual}
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
                    onClick={()=>setopenManual(false)}
                  >
                    Save
                  </button>
                  </div>
                </TabPanel>
                ))}
              </Box>
              ) : manualSizeFor === "tuxedo" ? (
                <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                  {tuxedoProducts.length > 0 && tuxedoProducts.map((pro, i)=> (
                    <Tab 
                      label={pro}
                      id ={`simple-tab-${i}`}
                      aria-controls = {`simple-tabpanel-${i}`}
                    />
                  ))}
                  </Tabs>
                </Box>
                {tuxedoProducts.length > 0 && tuxedoProducts.map((pro, j)=> (
                  <TabPanel value={value} index={j}>
                  <div>
                  {pro === "tuxedojacket" ? (
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
                            onClick={()=>downloadTuxedoScreenshot(pro)}
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
                            onClick={()=>downloadTuxedoScreenshot(pro)}
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
                    onClick={()=>setopenManual(false)}
                  >
                    Save
                  </button>
                  </div>
                </TabPanel>
                ))}
              </Box>
              ): manualSizeFor === "jacket" ||
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
                        type="text"
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
                        type="text"
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
                        type="text"
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
                          type="text"
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
        <Dialog
          onClose={handleClose1}
          open={open1}
          className={isActive ? "rigth-sideModel mui_show" : "rigth-sideModel"}
        >
          <DialogTitle>
            Product Measurement :{" "}
            <strong>
              {product_name
                ? product_name.charAt(0).toUpperCase() + product_name.slice(1)
                : ""}
            </strong>
          </DialogTitle>
          <>
          <Measurements 
          product_name = {product_name}
          customFittings = {customFittings}
          customerMeasurements = {customerMeasurements}
          setCustomerMeasurements = {setCustomerMeasurements}
          productMeasurements = {productMeasurements}
          setProductMeasurements = {setProductMeasurements}
          measurements = {measurements}
          totalMeasurements = {totalMeasurements}
          isMeasurementFilled={isMeasurementFilled}
          setIsMeasurementFilled={setIsMeasurementFilled}
          draftMeasurementsObject = {draftMeasurementsObject}
          handleSaveMeasurements = {handleSaveMeasurements}
          />
          </>
        </Dialog>

        <Dialog
          onClose={handleCloseSuit}
          open={suitOpen}
          className={isActive3 ? "rigth-sideModel mui_show" : "rigth-sideModel"}
        >
          <DialogTitle>Product Measurement</DialogTitle>
          <SuitMeasurements
            newMeasurement = {newMeasurement}
            setNew={setNew}
            suitcustomerMeasurements = {suitcustomerMeasurements}
            setSuitCustomerMeasurements = {setSuitCustomerMeasurements}
            suitSave = {suitSave}
          />
        </Dialog>

        <Dialog
          onClose={handleCloseTuxedo}
          open={tuxedoOpen}
          className={isActive4 ? "rigth-sideModel mui_show" : "rigth-sideModel"}
        >
          <DialogTitle>Product Measurement</DialogTitle>
          <TuxedoMeasurements
            newTuxedoMeasurement = {newTuxedoMeasurement}
            setNewTuxedoMeasurement={setNewTuxedoMeasurement}
            tuxedoCustomerMeasurements = {tuxedocustomerMeasurements}
            setTuxedoCustomerMeasurements = {setTuxedoCustomerMeasurements}
            tuxedoSave = {tuxedoSave}
          />
        </Dialog>

        <Dialog
          onClose={handleClose2}
          open={open2}
          className={isActive2 ? "rigth-sideModel mui_show" : "rigth-sideModel"}
        >
          <MissingFabric
            saveData={handleStyleDataSave}
            data={product_name}
            customerName={customerData.firstname}
            customerLastName={customerData.lastname}
            orders={orders}
            setOrders={setOrders}
          />
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
          <Button onClick={handleDelete} autoFocus>
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

{/* <>
            <div className="selecting-size">
              <div className="form-group">
                <label> Manual Fit </label>
                <select className="searchinput" onChange={handleCustomFitValue}>
                  <option value="0"> Select Size </option>
                  {customFittings !== null ? (
                    customFittings.map((fit, i) => {
                      return (
                        <option
                          key={i}
                          selected={
                            customerMeasurements[product_name] &&
                            customerMeasurements[product_name][
                              "fitting_type"
                            ] == fit.fitting_name
                              ? true
                              : false
                          }
                          data-name={fit.fitting_name}
                          value={fit.fitting_name}
                        >
                          {fit.fitting_name}
                        </option>
                      );
                    })
                  ) : (
                    <></>
                  )}
                </select>
              </div>
            </div>
            <div className="step-2styles-NM ">
              <div className="step-2Style-left">
                <div className="measurment-units-boxes">
                  <table>
                    <thead>
                      <tr>
                        <th> Measurement Name </th>
                        <th> Value </th>
                        <th> Adjustment </th>
                        <th> Total value </th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements
                        .slice(0, Math.ceil(totalMeasurements / 2))
                        .map((measurement, index) => {
                          return (
                            <tr key={measurement.name}>
                              <td>{(measurement.name).charAt(0).toUpperCase() + (measurement.name).slice(1)}</td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  value={
                                    productMeasurements[measurement.name][
                                      "value"
                                    ]
                                  }
                                  name={measurement.name + "-value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  value={
                                    productMeasurements[measurement.name][
                                      "adjustment_value"
                                    ]
                                  }
                                  disabled={adjustmentValueImmutable}
                                  name={measurement.name + "-adjustment_value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  disabled
                                  value={
                                    productMeasurements[measurement.name][
                                      "total_value"
                                    ]
                                  }
                                  name={measurement.name + "-total_value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              <td>
                              {draftMeasurementsObject && draftMeasurementsObject[product_name] && Number(draftMeasurementsObject[product_name]['measurements'][measurement.name]['total_value']) !== Number(productMeasurements[measurement.name]["total_value"])
                              ?
                              <span style={{color: "green"}}><CheckCircleOutlineIcon/></span>
                              :
                              <></>
                              }
                              </td>
                              
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="step-2Style-right">
                <div className="measurment-units-boxes">
                  <table>
                    <thead>
                      <tr>
                        <th> Measurement Name </th>
                        <th> Value </th>
                        <th> Adjustment </th>
                        <th> Total value </th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements
                        .slice(
                          Math.ceil(totalMeasurements / 2),
                          totalMeasurements.length
                        )
                        .map((measurement, index) => {
                          return (
                            <tr key={measurement.name}>
                              <td>{(measurement.name).charAt(0).toUpperCase() + (measurement.name).slice(1)}</td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  value={
                                    productMeasurements[measurement.name][
                                      "value"
                                    ]
                                  }
                                  name={measurement.name + "-value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  value={
                                    productMeasurements[measurement.name][
                                      "adjustment_value"
                                    ]
                                  }
                                  disabled={adjustmentValueImmutable}
                                  name={measurement.name + "-adjustment_value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  disabled
                                  value={
                                    productMeasurements[measurement.name][
                                      "total_value"
                                    ]
                                  }
                                  name={measurement.name + "-total_value"}
                                  onChange={handleValueChange}
                                  onClick={handleOnClick}
                                />
                              </td>
                              
                              <td>
                              {draftMeasurementsObject  && draftMeasurementsObject[product_name] && Number(draftMeasurementsObject[product_name]['measurements'][measurement.name]['total_value']) !== Number(productMeasurements[measurement.name]["total_value"])
                              ?
                              <span style={{color: "green"}}><CheckCircleOutlineIcon/></span>
                              :
                              <></>
                              }
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {product_name == "vest" ? (
              <></>
            ) : product_name == "pant" ? (
              <div className="fabric-types_NM">
                <h3 className="steper-title"> Pants Type </h3>
                <ul className="fabricselection_Common_NM">
                  <li>
                    <input
                      type="radio"
                      value="standard"
                      name="radioin"
                      id="standard"
                      checked={
                        customerMeasurements[product_name] &&
                        customerMeasurements[product_name]["pant_type"] === "standard"
                          ? true
                          : false
                      }
                      onChange={handleChangeType}
                    />
                    <label htmlFor="standard">
                      <img src="/ImagesFabric/pants/Standard.png" alt="" />
                      <p> Standard</p>
                    </label>
                  </li>
                  <li>
                    <input
                      type="radio"
                      value="slimfit"
                      name="radioin"
                      id="slimfit"
                      checked={
                        customerMeasurements[product_name] &&
                        customerMeasurements[product_name]["pant_type"] === "slimfit"
                          ? true
                          : false
                      }
                      onChange={handleChangeType}
                    />
                    <label htmlFor="slimfit">
                      <img src="/ImagesFabric/pants/SlimFit.png" alt="" />
                      <p> Slim Fit</p>
                    </label>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="fabric-types_NM">
                <h3 className="steper-title"> Shoulder Type </h3>
                <ul className="fabricselection_Common_NM">
                  <li>
                    <input
                      type="radio"
                      value="sloping"
                      name="radioin"
                      id="sloping"
                      checked={
                        product_name !== undefined &&
                        customerMeasurements[product_name] &&
                        customerMeasurements[product_name]["shoulder_type"] ===
                          "sloping"
                          ? true
                          : false
                      }
                      onChange={handleChangeType}
                    />

                    <label htmlFor="sloping">
                      <img src="/ImagesFabric/jacket/Sloping.png" alt="" />
                      <p> Sloping</p>
                    </label>
                  </li>
                  <li>
                     <input
                      type="radio"
                      value="standard"
                      name="radioin"
                      id="standard"
                      checked={
                        product_name !== undefined &&
                        customerMeasurements[product_name] &&
                        customerMeasurements[product_name]["shoulder_type"] ===
                          "standard"
                          ? true
                          : false
                      }
                      onChange={handleChangeType}
                    />
                    <label htmlFor="standard">
                      <img src="/ImagesFabric/jacket/Standard.png" alt="" />
                      <p> Standard</p>
                    </label>
                  </li>
                  <li>
                   <input
                      type="radio"
                      value="square"
                      name="radioin"
                      id="square"
                      checked={
                        product_name !== undefined &&
                        customerMeasurements[product_name] &&
                        customerMeasurements[product_name]["shoulder_type"] ===
                          "square"
                          ? true
                          : false
                      }
                      onChange={handleChangeType}
                    />
                    <label htmlFor="square">
                      <img src="/ImagesFabric/jacket/Square.png" alt="" />
                      <p> Square</p>
                    </label>
                  </li>
                </ul>
              </div>
            )}

            <div className="form-group">
              <label className="note"> Note </label>
              <textarea
                className="searchinput"
                value={
                  product_name !== undefined &&
                  customerMeasurements[product_name] &&
                  customerMeasurements[product_name]["notes"]
                    ? customerMeasurements[product_name]["notes"]
                    : ""
                }
                onChange={handleNoteChange}
                onClick={handleOnClick}
              />
            </div>
            <div>
              <Button
                className="custom-btn"
                onClick={handleSaveMeasurements}
                // disabled = {true}
              >
                Save
              </Button>
            </div>
          </> */}