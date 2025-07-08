import React, { useState, useContext, useEffect } from "react";
 import "./editOrder.css";
import { Button } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { axiosInstance } from "../../../../config";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../context/Context";
import MissingFabric from "./../../../FabricsAndStyling/MissingFabric";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Measurements from "../../../Measurements/Measurements";
import SuitMeasurements from "../../../Measurements/SuitMeasurements";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function Step4() {
  
  const { user } = useContext(Context);
  const location = useLocation();
  const path = location.pathname.split("/")[3];
  const [jacketCount, setJacketCount] = useState(0);
  const [productsNameArray, setProductsNameArray] = useState([]);
  const [productsNameSuitArray, setProductsNameSuitArray] = useState("");
  const [open, setOpen] = useState(false);
  const [suitOpen, setSuitOpen] = useState(false);
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
  const [adjustmentValueImmutable, setAdjustmentValueImmutable] =
    useState(false);
  const [notes, setNotes] = useState("");
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

  //Suit State
  const [suitcustomerMeasurements, setSuitCustomerMeasurements] = useState({});
  const [suitData, setSuit] = useState("");
  const [suitFilledMeasurements, setSuitFilledMeasurement] = useState([]);
  const [newMeasurement, setNew] = useState([]);
  const [isActive3, setIsActive3] = useState(false);
  const [success, setSuccess] = useState(false);
  const [draftMeasurementsObject, setDraftMeasurementsObject] = useState({})

  const [productFeaturesObject, setProductFeaturesObject] = useState({})
  const [isRushOrder, setIsRushOrder] = useState(false);
  const [stylesFinished, setStylesFinished] = useState(true)
  const [measurementsFinished, setMeasurementsFinished] = useState({})


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

    const fetchUserMeasurements = async () => {


      const res1 = await axiosInstance.post("/customerOrders/fetchOrderByID/" + path, { token: user.data.token });

      setOrders(res1.data.data[0]['order_items']);
      setCustomerData(res1.data.data[0]['customer_id']);

      if(res1.data.data[0]['order_status'] == "Rush"){
        setDate(res1.data.data[0]['rushOrderDate']);
        setIsRushOrder(true);
      }
      const drafts = JSON.parse(JSON.stringify(res1.data.data[0]['measurements']))
      setDraftMeasurementsObject(drafts)
      
      let num = 0

      for (let x of res1.data.data[0]['order_items']) {
        num += x['quantity'];
      }
     
      setJacketCount(num)

      const res = await axiosInstance.post(
        "/userMeasurement/fetchCustomerByID/" + res1.data.data[0]['customer_id']['_id']
      );
      console.log("res.data: ", res.data.data)

      setCustomer(res.data.data[0]);

      for (let x of res1.data.data[0]['order_items']) {
        productsNameArray.push(x.item_name)
        measurementsFinished[x.item_name] = true
      }
      setMeasurementsFinished({...measurementsFinished})

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
        console.log(x["quantity"]);
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
    setStylesFinished(false);
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
          setMeasurementsFinished({...measurementsFinished})
          
          setSuitCustomerMeasurements({ ...customer["suit"]});

        } else if (!suitFilledMeasurements.includes(res1.data.data[0]["name"])) {
          
          for (let x of res1.data.data[0].measurements) {
            obj[x.name] = {
              value: 0,
              adjustment_value: 0,
              total_value: 0,
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
      } else if((product_name == 'jacket' || product_name == 'pant') && customer['suit']){
        measurementsFinished['suit'] = true
        measurementsFinished['jacket'] = true
        measurementsFinished['pant'] = true
        setMeasurementsFinished({...measurementsFinished})
        setSuitCustomerMeasurements({ ...customer["suit"]});
      }else if (!filledMeasurements.includes(res.data.data[0]["name"])) {
        measurementsFinished[res.data.data[0]["name"]] = false
        setMeasurementsFinished({...measurementsFinished})
        measurementArray.map((measurement) => {
          obj[measurement.name] = {
            value: 0,
            adjustment_value: 0,
            total_value: 0,
          }
        })

        customerMeasurements[product_name] = { measurements: obj }

        setCustomerMeasurements({ ...customerMeasurements })
      }

      const orderArray = {
        item_name: product_name,
        quantity: 1,
      };
      orders.push(orderArray);

      setOrders([...orders]);
    }
  };
  console.log("customer measurements: ", customerMeasurements)
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
  console.log("styles array: ", orders)
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
    }

    setIsActive(false);

    const res = await axiosInstance.put(
      "/userMeasurement/updateCustomerMeasurementsSingle/" + customer['_id'],
      {
        measurements: { ...customerMeasurements},
        product: product_name
      }
    );

    customer["measurementsObject"] = customerMeasurements;
    setCustomer({ ...customer });

    console.log(Object.keys(res.data.data));

    setFilledMeasurements(Object.keys(res.data.data["measurementsObject"]));
    if(Object.keys(res.data.data["measurementsObject"]).includes('jacket') && Object.keys(res.data.data["measurementsObject"]).includes('pant')){
      measurementsFinished['suit'] = true
      setMeasurementsFinished({...measurementsFinished})
    }
    measurementsFinished[product_name] = true
    setMeasurementsFinished({...measurementsFinished})
    // setFilledMeasurements(product_name);

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
 
  //   if (orders.length > 0 && orders.length !== null) {
  //     if (orders[0].styles !== undefined) {
  //       const order = {
  //         customer_id: path,
  //         customerName: `${customerData.firstname} ${customerData.lastname}`,
  //         retailerName: user.data.retailer_name,
  //         retailer_code: user.data.retailer_code,
  //         retailer_id: user.data.id,
  //         order_items: orders,
  //         total_quantity: totalQuantity,
  //         orderDate: date,
  //       };

  //       const res = await axiosInstance.post("/customerOrders/create", {
  //         order: order,
  //         token: user.data.token,
  //       });

  //       navigate("/");
  //     } else {
  //       alert("please fill all product styling");
  //     }
  //   } else {
  //     alert("please select any product");
  //   }
  // };

  const handleEditOrder = async (e) => {
    const newOrderArray = orders
    for(let x of newOrderArray){
      let justA = []
      if(x['styles'].length == undefined){
        justA.push(x['styles'])
        x['styles'] = justA
      }

    }
    const order = {
      order_items: newOrderArray,
      rushOrderDate: date,
      total_quantity: jacketCount,
      measurements:customerMeasurements,
      Suitmeasurements: suitcustomerMeasurements
    }
    // const res = await axiosInstance.put("/userMeasurement/updateCustomerMeasurementsNewUpdate/" + customerData._id, customerData.measurementsObject, { token: user.data.token });
  if (orders.length > 0 && orders.length !== null && stylesFinished && !Object.values(measurementsFinished).includes(false)) {

    setShowPlaceOrderButton(true);
    const res1 = await axiosInstance.put("/customerOrders/updateOrder/" + path, { order: order, token: user.data.token });
    if (res1.data.status == true) {
      setOpen6(true)
      setSuccess(true)
      setSuccessMsg(res1.data.message);
      const pdfString =exportPDF(res1.data.data['_id'])
      navigate("/");
    } else {
      setOpen6(true)
      setError(true)
      setErrorMsg(res1.data.message)
    }
  }else{
      setErrorMsg("Please Complete the necesaary information!")
      setSuccess(false)
      setError(true)
  }

  }


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
          draftMeasurementsObj = existingOrders.data.data[ourIndex + 1]['measurements']
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

    const singleOrderArrayString = JSON.stringify(singleOrderArray)

    const productFeaturesObjectString = JSON.stringify(productFeaturesObject)

    const draftMeasurementsObjString = JSON.stringify(draftMeasurementsObj)

    // console.log("orderItemsArrayPDF: ", orderItemsArrayPDF)
    // console.log("singleOrderArray: ", singleOrderArray)
    const pdfString = await axiosInstance.post('customerOrders/createPdf', {
      token: user.data.token,
      // pdfStringJ : JSON.stringify(elementAsString)
      draftMeasurementsObj: draftMeasurementsObjString,
      productFeaturesObject: productFeaturesObjectString,
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
    console.log("res.data.data: ", res.data)
    if (
      orders.length == Object.keys(res.data.data["suit"]).length
    ) {
      setCanPlaceOrder(true);
    }
    setCanPlaceOrder(true);

    setSuitFilledMeasurement('suit');


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
      </Dialog>


      <div className="searchinput-inner">
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
                          : handleManageMeasurement
                      }
                      // onClick={handleManageMeasurement}
                      // style={filledMeasurements.includes(products.item_name) || suitFilledMeasurements.includes(products.item_name)
                      style={measurementsFinished[products.item_name] == true
                        ? completeMeasurementStyles
                        : missingMeasurementStyles}
                    >
                      {measurementsFinished[products.item_name] == true
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
              <strong className="pl_20">{jacketCount}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="boxedTWo mt-15">
      <button type="button" onClick={handleEditOrder} className="custom-btn">
      Edit Order
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "value"
                        ]
                        :
                        0
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "adjustment_value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "adjustment_value"
                        ]
                        :
                        0
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "total_value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "total_value"
                        ]
                        :
                        0
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

  <div className="step-2Style-right">
    <div className="measurment-units-boxes">
      <table>
        <thead>
          <tr>
            <th> Measurement Name </th>
            <th> Value </th>
            <th> Adjustment </th>
            <th> Total value </th>
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "value"
                        ]
                        :
                        0
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "adjustment_value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "adjustment_value"
                        ]
                        :
                        0
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
                        productMeasurements[measurement.name]
                        &&
                        productMeasurements[measurement.name][
                          "adjustment_value"
                        ]
                        ?

                        productMeasurements[measurement.name][
                          "total_value"
                        ]
                        :
                        0
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
) 
: product_name == "pant" ? (
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
) 
: (
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
  >
    Save
  </Button>
</div>
</> */}