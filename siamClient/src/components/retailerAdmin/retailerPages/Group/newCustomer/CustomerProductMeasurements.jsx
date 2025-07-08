import React, { useState, useEffect, useContext } from "react";
import { Button } from "@mui/material";
import { axiosInstance } from "../../../../../config";
import { Context } from "./../../../../../context/Context";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export default function CustomerProductMeasurements({
  customerMeasurements, setCustomerMeasurements,
  suitcustomerMeasurements, setSuitCustomerMeasurements, 
  tuxedocustomerMeasurements, setTuxedoCustomerMeasurements, 
  product_name, setProduct_name, 
  customerID,  
  customer ,setCustomer, 
  filledMeasurements, setFilledMeasurements, 
  setOpenMeasurementForm,
  draftMeasurementsObject,
  measurementsFinished,
  setMeasurementsFinished,
  productsMeasurementArray
}) {
  const { user } = useContext(Context);
  const [customFittings, setCustomFittings] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [totalMeasurements, setTotalMeasurements] = useState("");
  const [productMeasurements, setProductMeasurements] = useState({});
  const [suitProductMeasurements, setSuitProductMeasurements] = useState([]);
  const [tuxedoProductMeasurements, setTuxedoProductMeasurements] = useState([]);
  const [adjustmentValueImmutable, setAdjustmentValueImmutable] = useState(false);
  const [isMeasurementFilled, setIsMeasurementFilled] = useState(false);

  //Suit State
  const [newMeasurement, setNew] = useState([]);
  //Tuxedo State
  const [newTuxedoMeasurement, setNewTuxedoMeasurement] = useState([]);

  useEffect(() => {
  if(product_name == 'tuxedo'){ 
    const fetchProductMeasurements = async() => {
      for (let x of Object.keys(tuxedocustomerMeasurements)) { 
        let obj = {}
        const res = await axiosInstance.post(`/product/fetchForMeasurementsForSuit/${x}`, {token: user.data.token});
        const res1 = await axiosInstance.post("/customFittings/fetch/" + res.data.data[0]['_id'],{ token: user.data.token });
        obj['name'] = res.data.data[0]['name']
        obj['measurements'] = res.data.data[0]['measurements']
        obj['m'] = tuxedocustomerMeasurements[x]['measurements']
        obj['custom'] = res1.data.data
        let anArray = []
        for(let y of newTuxedoMeasurement){
          anArray.push(y['name'])
        }
        if(!anArray.includes(obj['name'])){
          newTuxedoMeasurement.push(obj)
          setNewTuxedoMeasurement([...newTuxedoMeasurement])
        } 

     
        if(customer["measurementsObject"]){
          if(Object.keys(customer['measurementsObject']).includes('pant') == true){
  
            if(customer['measurementsObject'][x]?.["fitting_type"]){
              tuxedocustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
              setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
            }
            if(customer['measurementsObject'][x]?.["measurements"]) {
              tuxedocustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
              // for(x of newMeasurement){
              //   if(x['name'] == 'jacket'){

              //   }
              // }
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
          if(Object.keys(customer['measurementsObject']).includes('tuxedojacket') == true){
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
          setTuxedoProductMeasurements(tuxedocustomerMeasurements[x]["measurements"])
        }
        
      }
    }
    fetchProductMeasurements()
  }else if(product_name == 'suit'){
      const fetchProductMeasurements = async() => {
        for (let x of Object.keys(suitcustomerMeasurements)) { 
          let obj = {}
          const res = await axiosInstance.post(`/product/fetchForMeasurementsForSuit/${x}`, {token: user.data.token});
          const res1 = await axiosInstance.post("/customFittings/fetch/" + res.data.data[0]['_id'],{ token: user.data.token });
          obj['name'] = res.data.data[0]['name']
          obj['measurements'] = res.data.data[0]['measurements']
          obj['m'] = suitcustomerMeasurements[x]['measurements']
          obj['custom'] = res1.data.data
          let anArray = []
          for(let y of newMeasurement){
            anArray.push(y['name'])
          }
          if(!anArray.includes(obj['name'])){
            newMeasurement.push(obj)
            setNew([...newMeasurement])
          } 

       
          if(customer["measurementsObject"]){
            if(Object.keys(customer['measurementsObject']).includes('pant') == true){
    
              if(customer['measurementsObject'][x]?.["fitting_type"]){
                suitcustomerMeasurements[x]["fitting_type"] = customer['measurementsObject'][x]['fitting_type']
                setSuitCustomerMeasurements({ ...suitcustomerMeasurements });
              }
              if(customer['measurementsObject'][x]?.["measurements"]) {
                suitcustomerMeasurements[x]["measurements"] = customer['measurementsObject'][x]['measurements']
                // for(x of newMeasurement){
                //   if(x['name'] == 'jacket'){

                //   }
                // }
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
            if(Object.keys(customer['measurementsObject']).includes('jacket') == true){
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
            setSuitProductMeasurements(suitcustomerMeasurements[x]["measurements"])
          }
          
        }
      }
      fetchProductMeasurements()
    } else {
      const fetchProductMeasurements = async () => {
        const res = await axiosInstance.post(`/product/fetchForMeasurementsForSuit/${product_name}`, {token: user.data.token})
        setMeasurements(res.data.data[0]['measurements'])
        setTotalMeasurements(res.data.data[0]['measurements'].length)
  
        const res1 = await axiosInstance.post(
          "/customFittings/fetch/" + res.data.data[0]['_id'],
          { token: user.data.token }
        );
    
        setCustomFittings(res1.data.data);
      }
      fetchProductMeasurements()
      if (customer['suit']) { 
        // for(let x of Object.keys(customer['suit'])) {
          if(Object.keys(customer['suit']).includes(product_name)) { 
            if(customer['suit'][product_name]?.["fitting_type"]){
              customerMeasurements[product_name]["fitting_type"] = customer['suit'][product_name]['fitting_type']
              setCustomerMeasurements({ ...customerMeasurements });
            }
            if(customer['suit'][product_name]?.['measurements']){
              customerMeasurements[product_name]["measurements"] = customer['suit'][product_name]['measurements']
              setProductMeasurements(customer['suit'][product_name]['measurements'])
              setCustomerMeasurements({ ...customerMeasurements });
            }
            if(customer['suit'][product_name]?.["pant_type"]){
              customerMeasurements[product_name]["pant_type"] = customer['suit'][product_name]['pant_type']
              setCustomerMeasurements({ ...customerMeasurements });
            }
            if(customer['suit'][product_name]?.["shoulder_type"]){
                customerMeasurements[product_name]["shoulder_type"] = customer['suit'][product_name]['shoulder_type']
                setCustomerMeasurements({ ...customerMeasurements });
            }
            if(customer['suit'][product_name]?.["notes"]){
              customerMeasurements[product_name]["notes"] = customer['suit'][product_name]['notes']
              setCustomerMeasurements({ ...customerMeasurements });
            }
          }else {
            if(customer['measurementsObject'] && customer['measurementsObject'][product_name]){
              // if(customer['measurementsObject'][product_name]){
              setProductMeasurements(
                customer['measurementsObject'][product_name]["measurements"]
              );
            }else{
              setProductMeasurements(
                productsMeasurementArray[product_name]["measurements"]
              );
            }
          }
        // }
      }else if(customer['tuxedo']){
        if(Object.keys(customer['tuxedo']).includes(product_name)) { 
          if(customer['tuxedo'][product_name]?.["fitting_type"]){
            customerMeasurements[product_name]["fitting_type"] = customer['tuxedo'][product_name]['fitting_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][product_name]?.['measurements']){
            customerMeasurements[product_name]["measurements"] = customer['tuxedo'][product_name]['measurements']
            setProductMeasurements(customer['tuxedo'][product_name]['measurements'])
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][product_name]?.["pant_type"]){
            customerMeasurements[product_name]["pant_type"] = customer['tuxedo'][product_name]['pant_type']
            setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][product_name]?.["shoulder_type"]){
              customerMeasurements[product_name]["shoulder_type"] = customer['tuxedo'][product_name]['shoulder_type']
              setCustomerMeasurements({ ...customerMeasurements });
          }
          if(customer['tuxedo'][product_name]?.["notes"]){
            customerMeasurements[product_name]["notes"] = customer['tuxedo'][product_name]['notes']
            setCustomerMeasurements({ ...customerMeasurements });
          }
        }else {
          if(customer['measurementsObject'] && customer['measurementsObject'][product_name]){
            // if(customer['measurementsObject'][product_name]){
            setProductMeasurements(
              customer['measurementsObject'][product_name]["measurements"]
            );
          }else{
            setProductMeasurements(
              productsMeasurementArray[product_name]["measurements"]
            );
          }
        }
      }else{
        setProductMeasurements(
          customerMeasurements[product_name]["measurements"]
        );
      }
    }
  },[])


 
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
      productMeasurements[string[0]]["repeat"] = false;
    } else if (string[1] == "adjustment_value") {
      productMeasurements[string[0]]["total_value"] =
      productMeasurements[string[0]]["value"] + value;
      productMeasurements[string[0]]["repeat"] = false;
    }
    productMeasurements[string[0]][string[1]] = value;
    setProductMeasurements({ ...productMeasurements });
    if(customerMeasurements[product_name]){
      customerMeasurements[product_name]["measurements"] = productMeasurements;
    }else{
      const obj = {}
      obj["measurements"] = productMeasurements;
      customerMeasurements[product_name] = obj

    }
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
    if(customer['_id']){
      const res = await axiosInstance.put(
        "/userMeasurement/updateCustomerMeasurementsSingle/" + customer['_id'],
        {
          measurements: { ...customerMeasurements},
          product: product_name
        }
      );
    }else{

    }
  

    customer["measurementsObject"] = customerMeasurements;
    setCustomer({ ...customer });

    measurementsFinished[product_name] = true
    // if(product_name == 'jacket' && measurementsFinished['pant'] == true && measurementsFinished['suit']){
    //   measurementsFinished['suit'] = true
    // }
    // if(product_name == 'pant' && measurementsFinished['jacket'] == true && measurementsFinished['suit']){
    //   measurementsFinished['suit'] = true
    // }
    
    setMeasurementsFinished({...measurementsFinished})


    // console.log(Object.keys(res.data.data["measurementsObject"]));

    // setFilledMeasurements(Object.keys(res.data.data["measurementsObject"]));
    // setFilledMeasurements(product_name);

    // if (
    //   orders.length == Object.keys(res.data.data["measurementsObject"]).length
    // ) {
    //   setCanPlaceOrder(true);
    // }
    // setCanPlaceOrder(true);
    setMeasurements([]);
    setProductMeasurements({});
    setProduct_name("");
    setOpenMeasurementForm(false)
  };


  const handleChangeType = async (e) => {
    if (product_name == "pant") {
    
      if(customerMeasurements[product_name]){
        customerMeasurements[product_name]["pant_type"] = e.target.value;
      }else{
        const obj = {}
        obj["pant_type"] = e.target.value;
        customerMeasurements[product_name] = obj
  
      }
      
      setCustomerMeasurements({ ...customerMeasurements });
    } else {
      if(customerMeasurements[product_name]){
        customerMeasurements[product_name]["shoulder_type"] = e.target.value;
      }else{
        const obj = {}
        obj["shoulder_type"] = e.target.value;
        customerMeasurements[product_name] = obj;  
      }
      setCustomerMeasurements({ ...customerMeasurements });

    }
  };

  const handleNoteChange = async (e) => {
    if(customerMeasurements[product_name]){
      customerMeasurements[product_name]["notes"] = e.target.value;
    }else{
      const obj = {}
      obj[product_name]["notes"] = e.target.value;
      customerMeasurements[product_name] = obj;  
    }
    setCustomerMeasurements({ ...customerMeasurements });
  };




//------------- SUIT Mesurement --------------------//

  const suitSave = async (e) => {
    // setIsActive3(false);

    if(customer['_id']){
      const res = await axiosInstance.put(
        "/userMeasurement/updatesuitCustomerMeasurements/" + customer['_id'],
        {
          measurements: { ...suitcustomerMeasurements },
        }
      );
    }

    customer["suit"] = { ...suitcustomerMeasurements };
    setCustomer({ ...customer });

    measurementsFinished[product_name] = true
    // if(measurementsFinished['jacket']){
    //   measurementsFinished['jacket'] = true
    // }
    // if(measurementsFinished['pant']){
    //   measurementsFinished['pant'] = true
    // }
    setMeasurementsFinished({...measurementsFinished})
    // if (
    //   orders.length == Object.keys(res.data.data["suit"]).length
    // ) {
    //   setCanPlaceOrder(true);
    // }
    // setCanPlaceOrder(true);

    // setSuitFilledMeasurement('suit');

    // if (
    //   orders.length == Object.keys(res.data.data["suit"]).length
    // ) {
    //   setCanPlaceOrder(true);
    // }

    // setSuitOpen(false);
    setNew([]);
    
    setOpenMeasurementForm(false)
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
    }else{
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


//------------- END --------------------//

//------------- TUXEDO Mesurement --------------------//

const tuxedoSave = async (e) => {
  // setIsActive3(false);
  console.log("customer new: ", customer)

  if(customer['_id']){
    const res = await axiosInstance.put(
      "/userMeasurement/updateTuxedoCustomerMeasurements/" + customer['_id'],
      {
        measurements: { ...tuxedocustomerMeasurements },
      }
    );
    console.log("ndasdnasd: ", res.data.data)
    customer['measurementsObject'] = res.data.data['measurementsObject']
    setCustomer({ ...customer });
  }
  customer["tuxedo"] = { ...tuxedocustomerMeasurements };
  setCustomer({ ...customer });

  measurementsFinished[product_name] = true
  // if(measurementsFinished['jacket']){
  //   measurementsFinished['jacket'] = true
  // }
  // if(measurementsFinished['pant']){
  //   measurementsFinished['pant'] = true
  // }
  setMeasurementsFinished({...measurementsFinished})
  // if (
  //   orders.length == Object.keys(res.data.data["suit"]).length
  // ) {
  //   setCanPlaceOrder(true);
  // }
  // setCanPlaceOrder(true);

  // setSuitFilledMeasurement('suit');

  // if (
  //   orders.length == Object.keys(res.data.data["suit"]).length
  // ) {
  //   setCanPlaceOrder(true);
  // }

  // setSuitOpen(false);
  setNewTuxedoMeasurement([]);
  
  setOpenMeasurementForm(false)
};

const tuxedohandleValueChange = async (e) => {
  let value = parseFloat(e.target.value);
  let string = e.target.name.split("-");
  if (string[1] === "value") {
    for (let x of newTuxedoMeasurement) {
      for (let y of Object.keys(x.m)) {
        if (y === string[0]) {
          x.m[string[0]]["total_value"] =
            x.m[string[0]]["adjustment_value"] + value;
        }
      }
    }
  } else if (string[1] === "adjustment_value") {
    for (let x of newTuxedoMeasurement) {
      for (let y of Object.keys(x.m)) {
        if (y === string[0]) {
          x.m[string[0]]["total_value"] = x.m[string[0]]["value"] + value;
        }
      }
    }
  }

  for (let z of newTuxedoMeasurement) {
    for (let u of Object.keys(z.m)) {
      if (u === string[0]) z.m[string[0]][string[1]] = value;
    }
  }

  for (let u of newTuxedoMeasurement) {
    tuxedocustomerMeasurements[u.name]["measurements"] = u.m;
  }
  setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
  setNewTuxedoMeasurement([...newTuxedoMeasurement]);
};

const handleTuxedoCustomFitValue = async (name, e) => {
  let arr = [];

  for (let y of newTuxedoMeasurement) {
    for (let z of y.custom) {
      if (z.fitting_name === e.target.value) {
        arr.push(z);
        for (let x of Object.keys(tuxedocustomerMeasurements)) {
          if (x == y.name) {
            tuxedocustomerMeasurements[x]["fitting_type"] = e.target.value;
          }
        }
      }
    }
  }
  const fitMeasure = arr.filter((x) => {
    return x.fitting_name == e.target.value;
  });

  setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });

  if (e.target.value == "0") {
    setAdjustmentValueImmutable(false);

    for (let y of newTuxedoMeasurement) {
      if (y.name === name) {
        for (let m of Object.keys(y.m)) {
          y.m[m]["adjustment_value"] = 0;
          y.m[m]["total_value"] =
            Number(y.m[m].value) + Number(y.m[m].adjustment_value);
        }
      }
    }
  }else{
    setAdjustmentValueImmutable(true);
    for (let x of fitMeasure[0].measurements) {
      for (let m of newTuxedoMeasurement) {
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

const handleTuxedoNoteChange = async (name, e) => {
  for (let y of newTuxedoMeasurement) {
    if (y.name === name) {
      for (let x of Object.keys(tuxedocustomerMeasurements)) {
        if (x == y.name) {
          tuxedocustomerMeasurements[x]["notes"] = e.target.value;
        }
      }
    }
  }

  setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
};

const handleTuxedoTypeChangeType = async (name, e) => {
  if (name === "pant") {
    for (let y of newTuxedoMeasurement) {
      if (y.name === name) {
        for (let x of Object.keys(tuxedocustomerMeasurements)) {
          if (x == y.name) {
            tuxedocustomerMeasurements[x]["pant_type"] = e.target.value;
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
        }
      }
    }
  } else {
    for (let y of newTuxedoMeasurement) {
      if (y.name === name) {
        for (let x of Object.keys(tuxedocustomerMeasurements)) {
          if (x == y.name) {
            tuxedocustomerMeasurements[x]["shoulder_type"] = e.target.value;
            setTuxedoCustomerMeasurements({ ...tuxedocustomerMeasurements });
          }
        }
      }
    }
  }
};

console.log("new tux: ", newTuxedoMeasurement)
//------------- END --------------------//


  return (

<div className="step4_wrapper_NM">
  <div className="step-4rushorderbox">
    <div className="step4BOXED">
        <h3 className="steper-title">Total Product Information 
        </h3>
        <p className="title-name-Short">
          <strong>
            {customer !== undefined
              ? `${customer.firstname} ${customer.lastname}`
              : ""}
          </strong>
        </p>
      </div>
    </div>


    <div>
        {product_name == 'suit'
        
        ?
        <>
            {newMeasurement.map((measurement, index) => {
              // console.log("in map measurements : ", measurement.m)
              return (
                <>
                  <div
                    style={{
                      marginTop: "15px",
                      borderBottom: "2px solid #e1e1e1",
                    }}
                  >
                    <div className="selecting-size">
                      <div className="form-group">
                        <strong>
                          {measurement.name.charAt(0).toUpperCase() +
                            measurement.name.slice(1)}{" "}
                        </strong>
                      </div>
                    </div>
                    <div className="selecting-size">
                      <div className="form-group">
                        <label> Manual Fit </label>
                        <select
                          className="searchinput"
                          onChange={(event) =>
                            handleSuitCustomFitValue(measurement.name, event)
                          }
                        >
                          <option value="0"> Select Size </option>
                          {measurement.custom !== null ? (
                            measurement.custom.map((fit, i) => {
                              return (
                                <option
                                  key={i}
                                  selected={
                                    suitcustomerMeasurements[
                                      measurement.name
                                    ] &&
                                    suitcustomerMeasurements[measurement.name][
                                      "fitting_type"
                                    ] == fit.fitting_name
                                      ? true
                                      : false
                                  }
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
                    <div className="f" key={index}>
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
                              {Object.keys(measurement.m)
                                .slice(
                                  0,
                                  Math.ceil(
                                    Object.keys(measurement.m).length / 2
                                  )
                                ).map((data, i) => {
                                  return (
                                    <tr key={data}>
                                      <td>{data.charAt(0).toUpperCase() + data.slice(1)}</td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          name={data + "-value"}
                                          value={measurement.m[data]["value"]}
                                          // value={suitProductMeasurements[data]['value']}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          value={
                                            measurement.m[data][
                                              "adjustment_value"
                                            ]
                                          }
                                          // value={suitProductMeasurements[data]['adjustment_value']}
                                          disabled={adjustmentValueImmutable}
                                          name={data + "-adjustment_value"}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          disabled
                                          value={
                                            measurement.m[data]["total_value"]
                                          }
                                          // value={suitProductMeasurements[data]['total_value']}
                                          name={data + "-total_value"}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        {draftMeasurementsObject  && draftMeasurementsObject[measurement.name] && draftMeasurementsObject[measurement.name]['measurements'][data] && Number(draftMeasurementsObject[measurement.name]['measurements'][data]['total_value']) !== Number(measurement.m[data]["total_value"])
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
                      <div className="step-2Style-rigth">
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
                              {Object.keys(measurement.m)
                                .slice(
                                  Math.ceil(
                                    Object.keys(measurement.m).length / 2
                                  ),
                                  measurement.length
                                )
                                .map((data, i) => {
                                  return (
                                    <tr key={i}>
                                      <td>{data.charAt(0).toUpperCase() + data.slice(1)}</td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          value={measurement.m[data]["value"]}
                                          name={data + "-value"}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          value={
                                            measurement.m[data][
                                              "adjustment_value"
                                            ]
                                          }
                                          disabled={adjustmentValueImmutable}
                                          name={data + "-adjustment_value"}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          className="searchinput"
                                          disabled
                                          value={
                                            measurement.m[data]["total_value"]
                                          }
                                          name={data + "-total_value"}
                                          onChange={suithandleValueChange}
                                          onClick={handleOnClick}
                                        />
                                      </td>
                                      <td>
                                        {draftMeasurementsObject  && draftMeasurementsObject[measurement.name] && draftMeasurementsObject[measurement.name]['measurements'][data] && Number(draftMeasurementsObject[measurement.name]['measurements'][data]['total_value']) !== Number(measurement.m[data]["total_value"])
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
                    {measurement.name == "jacket" ? (
                      <div className="fabric-types_NM">
                        <h3 className="steper-title"> Shoulder Type </h3>
                        <ul className="fabricselection_Common_NM">
                          <li>
                            <input
                              type="radio"
                              value="sloping"
                              name="d"
                              id="sloping"
                              checked={
                                suitcustomerMeasurements[measurement.name] &&
                                suitcustomerMeasurements[measurement.name][
                                  "shoulder_type"
                                ] == "sloping"
                                  ? true
                                  : false
                              }
                              onChange={(event) =>
                                handleSuitTypeChangeType(
                                  measurement.name,
                                  event
                                )
                              }
                            />

                            <label for="sloping">
                              <img
                                src="/ImagesFabric/jacket/sloping.png"
                                alt=""
                              />
                              <p> Sloping</p>
                            </label>
                          </li>
                          <li>
                            <input
                              type="radio"
                              value="standard"
                              name="d"
                              id="standard"
                              checked={
                                suitcustomerMeasurements[measurement.name] &&
                                suitcustomerMeasurements[measurement.name][
                                  "shoulder_type"
                                ] == "standard"
                                  ? true
                                  : false
                              }
                              onChange={(event) =>
                                handleSuitTypeChangeType(
                                  measurement.name,
                                  event
                                )
                              }
                            />
                            <label for="standard">
                              <img
                                src="/ImagesFabric/jacket/standard.png"
                                alt=""
                              />
                              <p> Standard</p>
                            </label>
                          </li>
                          <li>
                            <input
                              type="radio"
                              value="square"
                              name="d"
                              id="square"
                              checked={
                                suitcustomerMeasurements[measurement.name] &&
                                suitcustomerMeasurements[measurement.name][
                                  "shoulder_type"
                                ] == "square"
                                  ? true
                                  : false
                              }
                              onChange={(event) =>
                                handleSuitTypeChangeType(
                                  measurement.name,
                                  event
                                )
                              }
                            />
                            <label for="square">
                              <img
                                src="/ImagesFabric/jacket/square.png"
                                alt=""
                              />
                              <p> Square</p>
                            </label>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <></>
                    )}
                    {/* {measurement.name == "pant" ? (
                      <div className="fabric-types_NM">
                        <h3 className="steper-title"> Pants Type </h3>
                        <ul className="fabricselection_Common_NM">
                          <li>
                            <input
                              type="radio"
                              value="standard"
                              name="radioin"
                              id="standards"
                              checked={
                                suitcustomerMeasurements[measurement.name] &&
                                suitcustomerMeasurements[measurement.name][
                                  "pant_type"
                                ] == "standard"
                                  ? true
                                  : false
                              }
                              onChange={(event) =>
                                handleSuitTypeChangeType(
                                  measurement.name,
                                  event
                                )
                              }
                            />
                            <label for="standards">
                              <img
                                src="/ImagesFabric/pants/standard.png"
                                alt=""
                              />
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
                                suitcustomerMeasurements[measurement.name] &&
                                suitcustomerMeasurements[measurement.name][
                                  "pant_type"
                                ] == "slimfit"
                                  ? true
                                  : false
                              }
                              onChange={(event) =>
                                handleSuitTypeChangeType(
                                  measurement.name,
                                  event
                                )
                              }
                            />
                            <label for="slimfit">
                              <img
                                src="/ImagesFabric/pants/slimfit.png"
                                alt=""
                              />
                              <p> Slim Fit</p>
                            </label>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <></>
                    )} */}

                    <div className="form-group">
                      <label className="note"> Note </label>
                      <textarea
                        className="searchinput"
                        value={
                          suitcustomerMeasurements[measurement.name] &&
                          suitcustomerMeasurements[measurement.name]["notes"]
                            ? suitcustomerMeasurements[measurement.name][
                                "notes"
                              ]
                            : ""
                        }
                        onChange={(event) =>
                          handleSuitNoteChange(measurement.name, event)
                        }
                      />
                    </div>
                  </div>
                </>
              );
            })}

            <div>
              <Button className="custom-btn" onClick={suitSave}>
                Save
              </Button>
            </div>
          </>
        :
        product_name == 'tuxedo'
        ?
        <>
        {newTuxedoMeasurement.map((measurement, index) => {
          // console.log("in map measurements : ", measurement.m)
          return (
            <>
              <div
                style={{
                  marginTop: "15px",
                  borderBottom: "2px solid #e1e1e1",
                }}
              >
                <div className="selecting-size">
                  <div className="form-group">
                    <strong>
                      {measurement.name.charAt(0).toUpperCase() +
                        measurement.name.slice(1)}{" "}
                    </strong>
                  </div>
                </div>
                <div className="selecting-size">
                  <div className="form-group">
                    <label> Manual Fit </label>
                    <select
                      className="searchinput"
                      onChange={(event) =>
                        handleTuxedoCustomFitValue(measurement.name, event)
                      }
                    >
                      <option value="0"> Select Size </option>
                      {measurement.custom !== null ? (
                        measurement.custom.map((fit, i) => {
                          return (
                            <option
                              key={i}
                              selected={
                                tuxedocustomerMeasurements[
                                  measurement.name
                                ] &&
                                tuxedocustomerMeasurements[measurement.name][
                                  "fitting_type"
                                ] == fit.fitting_name
                                  ? true
                                  : false
                              }
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
                <div className="f" key={index}>
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
                          {Object.keys(measurement.m)
                            .slice(
                              0,
                              Math.ceil(
                                Object.keys(measurement.m).length / 2
                              )
                            ).map((data, i) => {
                              return (
                                <tr key={data}>
                                  <td>{data.charAt(0).toUpperCase() + data.slice(1)}</td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      name={data + "-value"}
                                      value={measurement.m[data]["value"]}
                                      // value={suitProductMeasurements[data]['value']}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      value={
                                        measurement.m[data][
                                          "adjustment_value"
                                        ]
                                      }
                                      // value={suitProductMeasurements[data]['adjustment_value']}
                                      disabled={adjustmentValueImmutable}
                                      name={data + "-adjustment_value"}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      disabled
                                      value={
                                        measurement.m[data]["total_value"]
                                      }
                                      // value={suitProductMeasurements[data]['total_value']}
                                      name={data + "-total_value"}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    {draftMeasurementsObject  && draftMeasurementsObject[measurement.name] && draftMeasurementsObject[measurement.name]['measurements'][data] && Number(draftMeasurementsObject[measurement.name]['measurements'][data]['total_value']) !== Number(measurement.m[data]["total_value"])
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
                  <div className="step-2Style-rigth">
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
                          {Object.keys(measurement.m)
                            .slice(
                              Math.ceil(
                                Object.keys(measurement.m).length / 2
                              ),
                              measurement.length
                            )
                            .map((data, i) => {
                              return (
                                <tr key={i}>
                                  <td>{data.charAt(0).toUpperCase() + data.slice(1)}</td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      value={measurement.m[data]["value"]}
                                      name={data + "-value"}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      value={
                                        measurement.m[data][
                                          "adjustment_value"
                                        ]
                                      }
                                      disabled={adjustmentValueImmutable}
                                      name={data + "-adjustment_value"}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="searchinput"
                                      disabled
                                      value={
                                        measurement.m[data]["total_value"]
                                      }
                                      name={data + "-total_value"}
                                      onChange={tuxedohandleValueChange}
                                      onClick={handleOnClick}
                                    />
                                  </td>
                                  <td>
                                    {draftMeasurementsObject  && draftMeasurementsObject[measurement.name] && draftMeasurementsObject[measurement.name]['measurements'][data] && Number(draftMeasurementsObject[measurement.name]['measurements'][data]['total_value']) !== Number(measurement.m[data]["total_value"])
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
                {measurement.name == "tuxedojacket" ? (
                  <div className="fabric-types_NM">
                    <h3 className="steper-title"> Shoulder Type </h3>
                    <ul className="fabricselection_Common_NM">
                      <li>
                        <input
                          type="radio"
                          value="sloping"
                          name="d"
                          id="sloping"
                          checked={
                            tuxedocustomerMeasurements[measurement.name] &&
                            tuxedocustomerMeasurements[measurement.name][
                              "shoulder_type"
                            ] == "sloping"
                              ? true
                              : false
                          }
                          onChange={(event) =>
                            handleTuxedoTypeChangeType(
                              measurement.name,
                              event
                            )
                          }
                        />

                        <label for="sloping">
                          <img
                            src="/ImagesFabric/jacket/sloping.png"
                            alt=""
                          />
                          <p> Sloping</p>
                        </label>
                      </li>
                      <li>
                        <input
                          type="radio"
                          value="standard"
                          name="d"
                          id="standard"
                          checked={
                            tuxedocustomerMeasurements[measurement.name] &&
                            tuxedocustomerMeasurements[measurement.name][
                              "shoulder_type"
                            ] == "standard"
                              ? true
                              : false
                          }
                          onChange={(event) =>
                            handleTuxedoTypeChangeType(
                              measurement.name,
                              event
                            )
                          }
                        />
                        <label for="standard">
                          <img
                            src="/ImagesFabric/jacket/standard.png"
                            alt=""
                          />
                          <p> Standard</p>
                        </label>
                      </li>
                      <li>
                        <input
                          type="radio"
                          value="square"
                          name="d"
                          id="square"
                          checked={
                            tuxedocustomerMeasurements[measurement.name] &&
                            tuxedocustomerMeasurements[measurement.name][
                              "shoulder_type"
                            ] == "square"
                              ? true
                              : false
                          }
                          onChange={(event) =>
                            handleTuxedoTypeChangeType(
                              measurement.name,
                              event
                            )
                          }
                        />
                        <label for="square">
                          <img
                            src="/ImagesFabric/jacket/square.png"
                            alt=""
                          />
                          <p> Square</p>
                        </label>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <></>
                )}
                {/* {measurement.name == "pant" ? (
                  <div className="fabric-types_NM">
                    <h3 className="steper-title"> Pants Type </h3>
                    <ul className="fabricselection_Common_NM">
                      <li>
                        <input
                          type="radio"
                          value="standard"
                          name="radioin"
                          id="standards"
                          checked={
                            suitcustomerMeasurements[measurement.name] &&
                            suitcustomerMeasurements[measurement.name][
                              "pant_type"
                            ] == "standard"
                              ? true
                              : false
                          }
                          onChange={(event) =>
                            handleSuitTypeChangeType(
                              measurement.name,
                              event
                            )
                          }
                        />
                        <label for="standards">
                          <img
                            src="/ImagesFabric/pants/standard.png"
                            alt=""
                          />
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
                            suitcustomerMeasurements[measurement.name] &&
                            suitcustomerMeasurements[measurement.name][
                              "pant_type"
                            ] == "slimfit"
                              ? true
                              : false
                          }
                          onChange={(event) =>
                            handleSuitTypeChangeType(
                              measurement.name,
                              event
                            )
                          }
                        />
                        <label for="slimfit">
                          <img
                            src="/ImagesFabric/pants/slimfit.png"
                            alt=""
                          />
                          <p> Slim Fit</p>
                        </label>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <></>
                )} */}

                <div className="form-group">
                  <label className="note"> Note </label>
                  <textarea
                    className="searchinput"
                    value={
                      tuxedocustomerMeasurements[measurement.name] &&
                      tuxedocustomerMeasurements[measurement.name]["notes"]
                        ? tuxedocustomerMeasurements[measurement.name][
                            "notes"
                          ]
                        : ""
                    }
                    onChange={(event) =>
                      handleTuxedoNoteChange(measurement.name, event)
                    }
                  />
                </div>
              </div>
            </>
          );
        })}

        <div>
          <Button className="custom-btn" onClick={tuxedoSave}>
            Save
          </Button>
        </div>
      </>
        :
          <>
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
                                    productMeasurements[measurement.name]
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
            // : product_name == "pant" ? (
            //   <div className="fabric-types_NM">
            //     <h3 className="steper-title"> Pants Type </h3>
            //     <ul className="fabricselection_Common_NM">
            //       <li>
            //         <input
            //           type="radio"
            //           value="standard"
            //           name="radioin"
            //           id="standard"
            //           checked={
            //             customerMeasurements[product_name] &&
            //             customerMeasurements[product_name]["pant_type"] === "standard"
            //               ? true
            //               : false
            //           }
            //           onChange={handleChangeType}
            //         />
            //         <label for="standard">
            //           <img src="/ImagesFabric/pants/standard.png" alt="" />
            //           <p> Standard</p>
            //         </label>
            //       </li>
            //       <li>
            //         <input
            //           type="radio"
            //           value="slimfit"
            //           name="radioin"
            //           id="slimfit"
            //           checked={
            //             customerMeasurements[product_name] &&
            //             customerMeasurements[product_name]["pant_type"] === "slimfit"
            //               ? true
            //               : false
            //           }
            //           onChange={handleChangeType}
            //         />
            //         <label for="slimfit">
            //           <img src="/ImagesFabric/pants/slimfit.png" alt="" />
            //           <p> Slim Fit</p>
            //         </label>
            //       </li>
            //     </ul>
            //   </div>
            // ) 
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

                    <label for="sloping">
                      <img src="/ImagesFabric/jacket/sloping.png" alt="" />
                      <p> Sloping</p>
                    </label>
                  </li>
                  <li>
                    {/* <input type="radio" value="standard" name="radioin" checked={jacket.shoulder_type === "standard"} id="standard" onChange={(e) => setJacket({ ...jacket, shoulder_type: e.target.value })} /> */}
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
                    <label for="standard">
                      <img src="/ImagesFabric/jacket/standard.png" alt="" />
                      <p> Standard</p>
                    </label>
                  </li>
                  <li>
                    {/* <input type="radio" value="square" name="radioin" checked={jacket.shoulder_type === "square"} id="square" onChange={(e) => setJacket({ ...jacket, shoulder_type: e.target.value })} /> */}
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
                    <label for="square">
                      <img src="/ImagesFabric/jacket/square.png" alt="" />
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
          </>
        
      
 

        }
      </div>
    </div>
  );
}





