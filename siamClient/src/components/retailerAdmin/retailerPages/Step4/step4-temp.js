import React, { useState, useContext, useEffect, useRef } from "react";
import "./Step4.css";
import { Button } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { axiosInstance } from "../../../../config";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import MissingFabric from "./../../../FabricsAndStyling/MissingFabric";
import { useNavigate } from "react-router-dom";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Measurements  from "../../../Measurements/Measurements";
import { v4 as uuidv4 } from "uuid";
import { PicBaseUrl, PicBaseUrl3, PicBaseUrl4 } from "../../../../imageBaseURL";
import jsPDF from "jspdf";
import mainQR from "../../../../images/PDFQR.png";
import { renderToString } from "react-dom/server";
import emailjs from '@emailjs/browser';
import SuitMeasurements from "../../../Measurements/SuitMeasurements";
import TuxedoMeasurements from "../../../Measurements/TuxedoMeasurements";
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function Step4() {
  const form = useRef();
  const { user } = useContext(Context);
  const location = useLocation();
  const path = location.pathname.split("/")[3];
  const [jacketCount, setJacketCount] = useState(0);
  const [productsNameArray, setProductsNameArray] = useState([]);
  const [productsNameSuitArray, setProductsNameSuitArray] = useState("");
  const [open, setOpen] = useState(false);
  const [suitOpen, setSuitOpen] = useState(false);
  const [tuxedoOpen, setTuxedoOpen] = useState(false);
  const [customer, setCustomer] = useState({});
  const [orders, setOrders] = useState([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [singleProduct, setSingleProduct] = useState({});
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState("");
  const [customerMeasurements, setCustomerMeasurements] = useState({});
  const [showPlaceOrderButton, setShowPlaceOrderButton] = useState(false);

  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [suitfabricOpen, setSuitfabricOpen] = useState(false);
  const [customFittings, setCustomFittings] = useState([]);
  const [suitCustomFitting, setSuitCustomFitting] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [totalMeasurements, setTotalMeasurements] = useState("");
  const [productMeasurements, setProductMeasurements] = useState({});
  const [productMeasurements1, setProductMeasurements1] = useState([]);
  const [product_name, setProduct_name] = useState("");
  const [id, setID] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // const [adjustmentValueImmutable, setAdjustmentValueImmutable] =
  //   useState(false);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isActive2, setIsActive2] = useState(false);
  const [isActive4, setIsActive4] = useState(false);
  const [filledMeasurements, setFilledMeasurements] = useState([]);
  const navigate = useNavigate();
  const [isMeasurementFilled, setIsMeasurementFilled] = useState(false);
  const [canPlaceOrder, setCanPlaceOrder] = useState(false);
  const [date, setDate] = useState("");
  const [customerData, setCustomerData] = useState([]);
  const [retailer, setRetailer] = useState({})

  //Suit State
  const [suitcustomerMeasurements, setSuitCustomerMeasurements] = useState({});
  const [suitData, setSuit] = useState("");
  const [suitFilledMeasurements, setSuitFilledMeasurement] = useState([]);
  const [newMeasurement, setNew] = useState([]);
  const [newTuxedoMeasurement, setNewTuxedoMeasurement] = useState([]);
  const [isActive3, setIsActive3] = useState(false);
  // const [isActive4, setIsActive4] = useState(false);
  const [isRushOrder, setIsRushOrder] = useState(false);
  const [draftMeasurementsObject, setDraftMeasurementsObject] = useState({})
  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [stylesFinished, setStylesFinished] = useState(false)
  const [measurementsFinished, setMeasurementsFinished] = useState({})
  const [tuxedo, setTuxedo] = useState()
  const [tuxedoCustomerMeasurements, setTuxedoCustomerMeasurements] = useState({})
  const [tuxedoFilledMeasurements, setTuxedoFilledMeasurement] = useState([]);


  // const [pdfData, setPdfData] = useState(null)

  // const [pdfFile, setPDFFile] = useState(null)

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

    fetchRetailer();

    const fetchUserMeasurements = async () => {
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + path, {token: user.data.token})
      if(existingOrders.data.status == true){
        setDraftMeasurementsObject(existingOrders.data.data[0]['measurements'])
      }

      const res = await axiosInstance.post(
        "/userMeasurement/fetchCustomerByID/" + path
      );

      
      setCustomer(res.data.data[0]);
      if (
        existingOrders.data.status == true && existingOrders.data.data[0]['measurements']
      ) {
        const drafts = JSON.parse(JSON.stringify(existingOrders.data.data[0]['measurements']))
       setCustomerMeasurements(drafts)
       setFilledMeasurements(Object.keys(drafts));

      }else if(
        res.data.data[0]["measurementsObject"] !== undefined &&
        res.data.data[0]["measurementsObject"] !== null
      ){
        if (Object.keys(res.data.data[0]["measurementsObject"]).length > 0) {
          setCustomerMeasurements(res.data.data[0]["measurementsObject"]);
          setFilledMeasurements(
            Object.keys(res.data.data[0]["measurementsObject"])
          );

      }
      } else {
      }

      if (
        res.data.data[0]["suit"] !== undefined &&
        res.data.data[0]["suit"] !== null
      ) {
        if (Object.keys(res.data.data[0]["suit"]).length > 0) {
          setSuitCustomerMeasurements(res.data.data[0]["suit"]);
          setSuitFilledMeasurement("suit");
        }
      } else  if (
        res.data.data[0]["tuxedo"] !== undefined &&
        res.data.data[0]["tuxedo"] !== null
      ) {
        if (Object.keys(res.data.data[0]["tuxedo"]).length > 0) {
          setTuxedoCustomerMeasurements(res.data.data[0]["tuxedo"]);
          setTuxedoFilledMeasurement("tuxedo");
        }
      }else {
      }
    };

    fetchUserMeasurements();
  }, [path]);

  useEffect(() => {
    const fetchCustomerData = async () => {
      const res1 = await axiosInstance.post(
        "/userMeasurement/fetchCustomerByID/" + path
      );
      setCustomerData(res1.data.data[0]);
    };
    fetchCustomerData();
  }, []);

  const IncNum = (e) => {
    for (let x of orders) {
      if (x.item_name == e.target.dataset.id) {
        x["quantity"] = x["quantity"] + 1;
        setJacketCount(jacketCount + 1);
        setTotalQuantity(jacketCount + 1);
        setOrders([...orders]);
      }
    }
  };

  const DecNum = (e) => {
    for (let x of orders) {
      if (x.item_name == e.target.dataset.id) {
        if (x["quantity"] > 0) {
          x["quantity"] = x["quantity"] - 1;
          setJacketCount(jacketCount - 1);
          setTotalQuantity(jacketCount);
          setOrders([...orders]);
        }
      }
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCustomer({ ...customer, orderDate: "" });
  };

  const handleChageDate = (e) => {
    if (e.target.value) {
      e.target.style.color = "red";
      setDate(e.target.value);

    }
  };

  const saveDate = (e) => {
    setOpen(false);
    setIsRushOrder(true);
  };

  const handleDelete = async (e) => {
    let ordersObject = orders.filter((order) => {
      return order.item_name !== e.target.dataset.id;
    });

    let productsNameArrayFilter = productsNameArray.filter((product) => {
      setSuit("");
      return product !== e.target.dataset.name;
    });

    let filledMeasurementsArray = filledMeasurements.filter((product) => {
      return product !== e.target.dataset.name;
    });

    delete measurementsFinished[e.target.dataset.id]
    setMeasurementsFinished({...measurementsFinished})

    setFilledMeasurements(filledMeasurementsArray);

    setProductsNameArray(productsNameArrayFilter);

    setOrders(ordersObject);

    let totalCount = 0;

    if (!ordersObject.length > 0) {
      setJacketCount(0);
      setTotalQuantity(0);
    } else {
      for (let x of ordersObject) {
        totalCount = totalCount + x["quantity"];
        setJacketCount(totalCount);
        setTotalQuantity(totalCount);
      }
    }
    let styleF = true
    for(let x of ordersObject){
      if(!x['styles']){
        styleF = false
      }
    }
    
    setStylesFinished(styleF)
  };

  const handleProduct = async (e) => {
    setCanPlaceOrder(false);
    
    setStylesFinished(false)

    setJacketCount(jacketCount + 1)
    setTotalQuantity(jacketCount + 1)

    if (e.target.value === "suit") {

      productsNameArray.push("suit");

      setSuit(e.target.value);
      
      let array = ["jacket", "pant"];

      if(filledMeasurements.includes('jacket') && filledMeasurements.includes('pant')){
        measurementsFinished['suit'] = true
        measurementsFinished['jacket'] = true
        measurementsFinished['pant'] = true
        setMeasurementsFinished({...measurementsFinished})
      }else{
        measurementsFinished['suit'] = false
        setMeasurementsFinished({...measurementsFinished})
      }

      for (let pro of array) {
        let res1 = await axiosInstance.post(
          "/product/fetchForMeasurementsForSuit/" + pro,
          {
            token: user.data.token,
          }
        );


        
        const obj = {};

        if (
          customer["suit"]
        ) {
          measurementsFinished['suit'] = true
          measurementsFinished['jacket'] = true
          measurementsFinished['pant'] = true
          setMeasurementsFinished({...measurementsFinished});
          setSuitCustomerMeasurements({ ...customer["suit"]});
        } else if (res1.data && res1.data.data && res1.data.data[0] && !suitFilledMeasurements.includes(res1.data.data[0]["name"])) {
          for (let x of res1.data.data[0].measurements) {
            obj[x.name] = {
              value: 0,
              adjustment_value: 0,
              total_value: 0,
              thai_name: x.thai_name
            };
          }
          
          suitcustomerMeasurements[pro] = { measurements: obj };
          setSuitCustomerMeasurements({ ...suitcustomerMeasurements });

        }
      }

      const orderArray = {
        item_name: "suit",
        quantity: 1,
      };

      orders.push(orderArray);

      setOrders([...orders]);

    } else if(e.target.value === "tuxedo"){
      productsNameArray.push("tuxedo");

      setTuxedo(e.target.value);
      
      let array = ["tuxedojacket", "pant"];

      if(filledMeasurements.includes('tuxedojacket') && filledMeasurements.includes('pant')){
        measurementsFinished['tuxedo'] = true
        measurementsFinished['tuxedojacket'] = true
        measurementsFinished['pant'] = true
        setMeasurementsFinished({...measurementsFinished})
      }else{
        measurementsFinished['tuxedo'] = false
        setMeasurementsFinished({...measurementsFinished})
      }

      for (let pro of array) {
        let res1 = await axiosInstance.post(
          "/product/fetchForMeasurementForTuxedo/" + pro,
          {
            token: user.data.token,
          }
        );

        const obj = {};
        if (
          customer["tuxedo"]
        ) {
          measurementsFinished['tuxedo'] = true
          measurementsFinished['tuxedojacket'] = true
          measurementsFinished['pant'] = true
          setMeasurementsFinished({...measurementsFinished});
          setTuxedoCustomerMeasurements({ ...customer["tuxedo"]});
        } else if (res1.data && res1.data.data && res1.data.data[0] && !tuxedoFilledMeasurements.includes(res1.data.data[0]["name"])) {
          for (let x of res1.data.data[0].measurements) {
            obj[x.name] = {
              value: 0,
              adjustment_value: 0,
              total_value: 0,
              thai_name: x.thai_name
            };
          }
          
          tuxedoCustomerMeasurements[pro] = { measurements: obj };
          setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });

        }
      }

      const orderArray = {
        item_name: "tuxedo",
        quantity: 1,
      };

      orders.push(orderArray);

      setOrders([...orders]);

    } else {
      const res = await axiosInstance.post(
        "/product/fetchForMeasurements/" + e.target.value,
        {
          token: user.data.token,
        }
      );

      const product_name = res.data.data[0]["name"];
      const measurementArray = res.data.data[0].measurements;

      productsNameArray.push(res.data.data[0]["name"]);

      setProductsNameArray([...productsNameArray]);
      
      const obj = {};
    
      if (
        customer["measurementsObject"] &&
        customer["measurementsObject"][res.data.data[0]["name"]]
      ) {
        filledMeasurements.push(res.data.data[0]["name"]);
        measurementsFinished[res.data.data[0]["name"]] = true
        setMeasurementsFinished({...measurementsFinished})
        customerMeasurements[product_name] =
        customer["measurementsObject"][res.data.data[0]["name"]];
        setCustomerMeasurements({ ...customerMeasurements });
      }else if((product_name == 'jacket' || product_name == 'pant') && customer['suit']){
          measurementsFinished['suit'] = true
          measurementsFinished['jacket'] = true
          measurementsFinished['pant'] = true
          setMeasurementsFinished({...measurementsFinished})
          setSuitCustomerMeasurements({ ...customer["suit"]});
      } else if (!filledMeasurements.includes(res.data.data[0]["name"])) {

        measurementsFinished[res.data.data[0]["name"]] = false
        setMeasurementsFinished({...measurementsFinished})

        measurementArray.map((measurement) => {
          obj[measurement.name] = {
            value: 0,
            adjustment_value: 0,
            total_value: 0,
            thai_name: measurement.thai_name
          }
        })

        customerMeasurements[product_name] = { measurements: obj }

        setCustomerMeasurements({ ...customerMeasurements });
      }

      const orderArray = {
        item_name: product_name,
        quantity: 1,
      };



      orders.push(orderArray);

      setOrders([...orders]);
    }
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
    setTuxedoOpen(false)
  }

  const handleOnClick = async (e) => {
    e.target.value = "";
  };
  console.log(customer)
  const handleSaveMeasurements = async (e) => {
    setIsActive(false);
    const res = await axiosInstance.put(
      "/userMeasurement/updateCustomerMeasurementsSingle/" + path,
      {
        measurements: {...customerMeasurements},
        product: product_name
      }
    );

    customer["measurementsObject"] = customerMeasurements;
    setCustomer({ ...customer });

    filledMeasurements.push(product_name)
    setFilledMeasurements([...filledMeasurements]);
    if(res.data.data["measurementsObject"] && Object.keys(res.data.data["measurementsObject"]).includes('jacket') && Object.keys(res.data.data["measurementsObject"]).includes('pant')){
      // measurementsFinished['suit'] = true
      // setMeasurementsFinished({...measurementsFinished})
    }
    measurementsFinished[product_name] = true
    setMeasurementsFinished({...measurementsFinished})

    if ( res.data.data["measurementsObject"] && 
      orders.length == Object.keys(res.data.data["measurementsObject"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);
    setMeasurements([]);
    setProductMeasurements({});
    setProduct_name("");
    setOpen1(false)
  };
  const handlePlaceOrder = async (e) => {
    if (orders.length > 0 && orders.length !== null && stylesFinished && !Object.values(measurementsFinished).includes(false)) {

      if (orders[0].styles !== undefined) {

      setShowPlaceOrderButton(true);

        const order = 
        {
          customer_id: path,
          customerName: `${customerData.firstname} ${customerData.lastname}`,
          retailerName: user.data.retailer_name,
          retailer_code: user.data.retailer_code,
          retailer_id: user.data.id,
          measurements:customerMeasurements,
          Suitmeasurements: suitcustomerMeasurements,
          Tuxedomeasurements: tuxedoCustomerMeasurements,
          order_items: orders,
          total_quantity: totalQuantity,
          rushOrderDate: date,
        };

        const res = await axiosInstance.post("/customerOrders/create", {
          order: order,
          token: user.data.token,
        });

        if(res.data.status == true){
          const pdfString =  exportPDF(res.data.data['_id'])
          navigate("/");
        }
        else{
          setShowPlaceOrderButton(false);
          setErrorMsg(res.data.message)
          setSuccess(false)
          setError(true)
        }

      } else {     
        setErrorMsg("Please Complete the necesaary information!")
        setSuccess(false)
        setError(true)
      }
    } else { 
      
      setErrorMsg("Please Complete the necesaary information!")
      setSuccess(false)
      setError(true)
    }
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
    // const res2 = await axiosInstance.post("/draftMeasurements/fetch/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
    let draftMeasurementsObj = {}
    if(res.data.data[0].repeatOrder == true){
      const previousOrder = await axiosInstance.post("/customerOrders/fetchOrderByID/" + res.data.data[0]['repeatOrderID'], {token : user.data.token})
      draftMeasurementsObj = previousOrder.data.data[0]['measurements']
    }else{
      const existingOrders = await axiosInstance.post("/customerOrders/fetchCustomerOrders/" + res.data.data[0]['customer_id']['_id'], {token: user.data.token})
      if(existingOrders.data.status == true){
        let ind = 0;
        let ourIndex ;
        for(let x of existingOrders.data.data){
          if(x['_id'] == order){
            ourIndex = ind
          }
          ind = ind + 1
        }
        if(existingOrders.data.data.length > 1)
        {
          draftMeasurementsObj = existingOrders.data.data[ourIndex-1]['measurements']
        }
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
      }else if (m.item_name == "tuxedo") {
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
      // for (let n = 1; n <= Object.keys(m["styles"][0]).length; n++) {
      //   let itemsObject = {
      //     item_name: m["item_name"],
      //     item_code: m["item_name"] + " " + n,
      //     quantity: m["quantity"],
      //     repeatOrder: res.data.data[0]["repeatOrder"],
      //     styles: m["styles"][0][Object.keys(m["styles"][0])[n - 1]],
      //   };

      //   if (j % 5 == 0 || orderItemsArray.length == j) {
      //     justAnArray.push(itemsObject);
      //     orderItemsArrayPDF.push(orderItemsArray);
      //     justAnArray = [];
      //   } else {
      //     justAnArray.push(itemsObject);
      //   }

      //   j = j + 1;
      // }
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
                 res.data.data[0].manualSize["jacket"]
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
                 res.data.data[0].manualSize["pant"]
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
                 res.data.data[0].manualSize['jacket']
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
 
    const orderItemsArrayPDFString = JSON.stringify(orderItemsArrayPDF)
// 
    const singleOrderArrayString = JSON.stringify(singleOrderArray)
// 
    const productFeaturesObjectString = JSON.stringify(productFeaturesObject)

    const draftMeasurementsObjString = JSON.stringify(draftMeasurementsObj)

    const pdfString = await axiosInstance.post('customerOrders/createPdf', {
      token: user.data.token,
      productFeaturesObject: productFeaturesObjectString,
      orderItemsArray: orderItemsArrayPDFString,
      singleOrderArray: singleOrderArrayString,
      draftMeasurementsObj: draftMeasurementsObjString,
      order: JSON.stringify(res.data.data[0]),
      retailer: JSON.stringify(res1.data.data[0])
    })

    if(pdfString.data.status == true){
      const sendMail = await axiosInstance.post('customerOrders/sendMail', {
        token: user.data.token,
        order: res.data.data[0]['orderId']
      })
    }
    
  };

  // ===========================================
  // ===========================================
  console.log("show ", stylesFinished)
  const handleStyleDataSave = async (e) => {
    let styleF = true
    for(let x of orders){
      if(!x['styles']){
        styleF = false
      }
    }
    setStylesFinished(styleF)
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
    setProduct_name('suit')
    setIsActive3(true);
    setSuitOpen(true);
  };
  
  const suitSave = async (e) => {
    setIsActive3(false);

    const res = await axiosInstance.put(
      "/userMeasurement/updatesuitCustomerMeasurements/" + path,
      {
        measurements: { ...suitcustomerMeasurements },
      }
    );

    customer["suit"] = { ...suitcustomerMeasurements } ;
    setCustomer({ ...customer });

    if (res.data.data["suit"] &&
      orders.length == Object.keys(res.data.data["suit"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);

    setSuitFilledMeasurement('suit');

    measurementsFinished['suit'] = true
    setMeasurementsFinished({...measurementsFinished})

    setSuitOpen(false);
    setNew([]);
  };

//------------- END --------------------//

// ------------ Tuxedo Measurement ------------------//

  const handleTuxedoMeasurements = async (e) => {
    for (let x of Object.keys(tuxedoCustomerMeasurements)) {
      const product = products.filter((pro) => {
        return pro.name == x;
      });

      if(customer["measurementsObject"]){


        if(Object.keys(customer['measurementsObject']).includes('pant') == true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            tuxedoCustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            tuxedoCustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["pant_type"]) {
            tuxedoCustomerMeasurements[x]["pant_type"] = customer['measurementsObject'][x]['pant_type']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            tuxedoCustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
        }
        if(Object.keys(customer['measurementsObject']).includes('tuxedojacket')== true){

          if(customer['measurementsObject'][x]?.["fitting_type"]){
            tuxedoCustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["measurements"]) {
            tuxedoCustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["shoulder_type"]) {
            tuxedoCustomerMeasurements[x]["shoulder_type"] = customer['measurementsObject'][x]['shoulder_type']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
          if(customer['measurementsObject'][x]?.["notes"]) {
            tuxedoCustomerMeasurements[x]["notes"] = customer['measurementsObject'][x]['notes']
            setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
          }
        }

      }else{
        setProductMeasurements1(tuxedoCustomerMeasurements[x]["measurements"])
      }

      let check = "true";

      Object.keys(tuxedoCustomerMeasurements[x]["measurements"]).map(
        (measurements) => {
          if (
            !tuxedoCustomerMeasurements[x]["measurements"][measurements][
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
          m: tuxedoCustomerMeasurements[x]["measurements"],
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
        measurements: { ...tuxedoCustomerMeasurements },
      }
    );

    customer["tuxedo"] = { ...tuxedoCustomerMeasurements } ;
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
//-------------END----------------------//

// ===========================================================
// ===========================================================

const fetchRetailer = async() => {
  const res = await axiosInstance.post("/retailer/fetch/" + user.data.id, {token: user.data.token})
  setRetailer(res.data.data[0])
}

// ===========================================================
// ===========================================================



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
        <div className="boxedTWo pd-15">
          <button
            type="button"
            className={isRushOrder ? "custom-btn rushOrderButton" : "custom-btn"}
            onClick={handleClickOpen}
          >
            Rush order
          </button>
        </div>
      </div>
      <Dialog
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
            <p> Need By Date </p>
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
      </Dialog>


      <div className="searchinput-inner">
        <p>
          Product <span className="red-required">*</span>
        </p>
        <select className="searchinput" onChange={handleProduct}>
          {productsNameArray.length > 0 ? (
            <option style={{ backgroundColor: "#62626b", color: "#fff" }}>
              {productsNameArray.join(", ")}
            </option>
          ) : (
            <option>Select a Product</option>
          )}

          {productsNameArray.includes("suit") ? "" : <option value={"suit"}>
            Suit
          </option>}
          {productsNameArray.includes("tuxedo") ? "" : <option value={"tuxedo"}>
            Tuxedo
          </option>}
          {products.map((product, i) => {
            if (!productsNameArray.includes(product.name)) {
              return (
                <option key={i} value={product._id} data-name={product.name}>
                  {product.name.charAt(0).toUpperCase() + product.name.slice(1)}
                </option>
              );
            }
          })}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>Measurement</th>
            <th>fabric & styling</th>
            <th> QTY </th>
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
                          : products.item_name === "tuxedo"
                          ? handleTuxedoMeasurements 
                          : handleManageMeasurement
                      }
                      // style={filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name)
                      style={measurementsFinished[products.item_name] == true
                        ? completeMeasurementStyles
                        : missingMeasurementStyles}
                    >
                      {measurementsFinished[products.item_name] == true
                      //{filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name) 
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
                  <td>
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
                  </td>
                  <td>
                    <button
                      value={products.item_name}
                      data-name={products.item_name}
                      data-id={products.item_name}
                      onClick={(event) => handleDelete(event)}
                      className="delete-Btn"
                    >
                      Delete
                    </button>
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
              <strong className="pl_20">{totalQuantity}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="boxedTWo mt-15">
        <button type="button" onClick={handlePlaceOrder} disabled={showPlaceOrderButton} className="custom-btn">
        
          Place Order
          
        </button>
      </div>
      <div>
        
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
            tuxedoCustomerMeasurements = {tuxedoCustomerMeasurements}
            setTuxedoCustomerMeasurements = {setTuxedoCustomerMeasurements}
            tuxedoSave = {tuxedoSave}
          />
        </Dialog>

        <Dialog
          onClose={handleClose2}
          open={open2}
          className={isActive2 ? "rigth-sideModel mui_show missingFabricDailogueBox" : "rigth-sideModel missingFabricDailogueBox"}
        >
          <MissingFabric
            saveData={handleStyleDataSave}
            data={product_name}
            customerName={customerData.firstname}
            customerLastName={customerData.lastname}
            orders={orders}
            setOrders={setOrders}
            jacketCount={jacketCount}
            setJacketCount={setJacketCount}
            setTotalQuantity={setTotalQuantity}
          />
        </Dialog>

        <Dialog
        open={showPlaceOrderButton}
        // onClose={}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
        </DialogTitle>
        <DialogContent>
          <div>
            <CircularProgress/>
          </div>
        </DialogContent>
      </Dialog> 
      {success && (
          <Snackbar open={success} autoHideDuration={2000} onClose={() => setSuccess(false)}>
            <Alert
              onClose={() => setSuccess(false)}
              severity="success"
              sx={{ width: "100%" }}
            >
              {successMsg}
            </Alert>
          </Snackbar>
        )}
        {error && (
          <Snackbar
            open={error}
            autoHideDuration={2000}
            onClose={() => setError(false)}
            action={action}
          >
            <Alert onClose={() => setError(false)} severity="error" sx={{ width: "100%" }}>
              {errorMsg}
            </Alert>
          </Snackbar>
        )}
  
    
      </div>
    </div>
  );
}





