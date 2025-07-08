import React, { useState, useContext, useEffect } from "react";
import "./NewOrder.css";
import { Button } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import { axiosInstance } from "./../../../../../config";
import { useLocation } from "react-router-dom";
import { Context } from "./../../../../../context/Context";
import MissingFabric from "./../../../../FabricsAndStyling/MissingFabric";
import Customers from "./../customers/Customers"
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import NewCustomer from "./../newCustomer/NewCustomer"

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function NewOrder() {
  const { user } = useContext(Context);

  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setsuccessMsg] = useState("");
  const [error, setError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const location = useLocation();
  const path = location.pathname.split("/")[3];
  const [jacketCount, setJacketCount] = useState(0);
  const [productsNameArray, setProductsNameArray] = useState([]);
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [products, setProducts] = useState([]);
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [product_name, setProduct_name] = useState();
  const [isActive, setIsActive] = useState(false);
  const [isActive2, setIsActive2] = useState(false);
  const [filledMeasurements, setFilledMeasurements] = useState([]);
  const navigate = useNavigate();
  const [canPlaceOrder, setCanPlaceOrder] = useState(true);
  const [date, setDate] = useState("");
  const [showCustomerTable, setCustomerTable] = useState(0);
  const [id, setId] = useState("");
  const [stylesFinished, setStylesFinished] = useState(false)

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
  const [groupOrder, setGroupOrder] = useState({
    retailer_id: user.data.retailer_id,
    retailer_code: user.data.retailer_code,
    retailerName: user.data.retailer_name,
    name: "",
    customer_quantity: 2,
    phone: "",
    order_items: {},
    product_quantity: 0,
    products: [],
  });

  const [newCustomerArray, setNewCustomerArray] = useState([]);

  // ================ new states ======================

  const [productsArrayObject, setProductsArrayObject] = useState([]);
  const [groupOrderMeasurements, setGroupOrderMeasurements] = useState({});
  const [customerID, setCustomerID] = useState("");
  const [productsDrop, setProductsDrop] = useState([]);
  const [measurementsFinished, setMeasurementsFinished] = useState({})

  // ==================================================

  // =================abbas============================
  // ==================================================

  // =============new states===========================
  const [openCustomerForm, setOpenCustomerForm] = useState(false)
  const [productsMeasurementArray, setProductsMeasurementArray] = useState({})
  const [suitProductsMeasurementArray, setSuitProductsMeasurementArray] = useState({})
  const [tuxedoProductsMeasurementArray, setTuxedoProductsMeasurementArray] = useState({})
  const [showAddCustomerButton, setshowCustomerAddButton] = useState(false);
  const [customerArray, setCustomerArray] = useState([]);
  const [groupOrderCustomers, setGroupOrderCustomers] = useState([])
  // ==================================================


  // ==================================================
  // ==================================================
  const excludeProduct = ["jacket(suit)", "pant(suit)", "tuxedojacket(tuxedo)", "pant(tuxedo)"];
  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      setProducts(res.data.data);
      const products = res.data.data.filter(
        (product) => !excludeProduct.includes(product.name)
      );
      // console.log(res.data.data)
      for (let x of res.data.data) {
        if (!Object.keys(productsMeasurementArray).includes(x['name'])) {
          const obj = {};
          x['measurements'].map((measurement) => {
            obj[measurement.name] = {
              value: 0,
              adjustment_value: 0,
              total_value: 0,
              thai_name: measurement.thai_name
            };
          });
          if (x['name'] == 'jacket' || x['name'] == 'pant') {
            if (!Object.keys(suitProductsMeasurementArray).includes(x['name'])) {
              suitProductsMeasurementArray[x['name']] = { measurements: obj }
              setSuitProductsMeasurementArray({ ...suitProductsMeasurementArray })
            }
          }
          if (x['name'] == 'tuxedojacket' || x['name'] == 'pant') {
            if (!Object.keys(tuxedoProductsMeasurementArray).includes(x['name'])) {
              tuxedoProductsMeasurementArray[x['name']] = { measurements: obj }
              setTuxedoProductsMeasurementArray({ ...tuxedoProductsMeasurementArray })
            }
          }
          productsMeasurementArray[x['name']] = { measurements: obj }
          setProductsMeasurementArray({ ...productsMeasurementArray })
        }
      }
      setProductsDrop(products);
    };
    fetchProducts();
  }, [path]);

  useEffect(() => {
    if (path && path.length > 0) {
      setStylesFinished(true)
      fetchOrder(path)
    } else if (customerArray.length > 0 && id.length > 0) {
      setStylesFinished(true)
      fetchOrder(id)
    }
  }, [path, id])

  // console.log("sflkjd:  ", groupOrder)
  const IncNum = (e) => {
    for (let x of orders) {
      if (x.item_name == e.target.dataset.name) {
        x["quantity"] = x["quantity"] + 1;
        setJacketCount(jacketCount + 1);
        setTotalQuantity(jacketCount + 1);
        setOrders([...orders]);
      }
    }
  };


  const DecNum = (e) => {
    for (let x of orders) {
      if (x.item_name == e.target.dataset.name) {
        if (x["quantity"] > 0) {
          x["quantity"] = x["quantity"] - 1;
          setJacketCount(jacketCount - 1);
          setOrders([...orders]);
          setTotalQuantity(jacketCount - 1);
        }
      }
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClick = () => {

  };

  const handleClose = () => {
    setOpen(false);
    // setCustomer({ ...customer, orderDate: "" });
  };

  const handleChageDate = (e) => {
    if (e.target.value) {
      e.target.style.color = "red";
      const [year, month, day] = e.target.value.split("-");
      const result = [day, month, year].join("-");
      setDate(result);
    }
  };

  const saveDate = (e) => {
    setOpen(false);
  };
  // This function creates array for product measurements works when you add a product in the list.
  const handleProduct = async (e) => {
    setCanPlaceOrder(false);
    setStylesFinished(false)
    setJacketCount(jacketCount + 1)
    setTotalQuantity(jacketCount + 1)


    if (e.target.value === "suit") {

      productsNameArray.push("suit");

      let array = ["jacket", "pant"];

      for (let pro of array) {
        let res1 = await axiosInstance.post(
          "/product/fetchForMeasurementsForSuit/" + pro,
          {
            token: user.data.token,
          }
        );
        const obj = {};

        for (let x of res1.data.data[0].measurements) {
          obj[x.name] = {
            value: 0,
            adjustment_value: 0,
            total_value: 0,
            thai_name: x.thai_name
          };
        }

        suitProductsMeasurementArray[pro] = { measurements: obj }
        setSuitProductsMeasurementArray({ ...suitProductsMeasurementArray })
      }

      const orderArray = {
        item_name: "suit",
        quantity: 1,
      };

      orders.push(orderArray);

      setOrders([...orders]);

    } else if (e.target.value === "tuxedo") {

      productsNameArray.push("tuxedo");

      let array = ["tuxedojacket", "pant"];

      for (let pro of array) {
        let res1 = await axiosInstance.post(
          "/product/fetchForMeasurementsForSuit/" + pro,
          {
            token: user.data.token,
          }
        );
        const obj = {};

        for (let x of res1.data.data[0].measurements) {
          obj[x.name] = {
            value: 0,
            adjustment_value: 0,
            total_value: 0,
            thai_name: x.thai_name
          };
        }

        tuxedoProductsMeasurementArray[pro] = { measurements: obj }
        setTuxedoProductsMeasurementArray({ ...tuxedoProductsMeasurementArray })
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

      const measurementArray = res.data.data[0].measurements;
      const product_name = res.data.data[0]["name"];


      productsNameArray.push(res.data.data[0]["name"]);

      setProductsNameArray([...productsNameArray]);

      const obj = {};

      // if(customer["measurementsObject"] && customer["measurementsObject"][res.data.data[0]["name"]]) {
      //     filledMeasurements.push(res.data.data[0]["name"]);
      // } else if (!filledMeasurements.includes(res.data.data[0]["name"])) {
      measurementArray.map((measurement) => {
        obj[measurement.name] = {
          value: 0,
          adjustment_value: 0,
          total_value: 0,
          thai_name: measurement.thai_name
        };
      });
      productsMeasurementArray[product_name] = { measurements: obj }
      setProductsMeasurementArray({ ...productsMeasurementArray })
      // }

      const orderArray = {
        item_name: product_name,
        quantity: 1,
      };

      orders.push(orderArray);
      setOrders([...orders]);
    }
  };


  const handleDelete = async (e) => {
    let ordersObject = orders.filter((order) => {
      return order.item_name !== e.target.dataset.name;
    });


    setOrders(ordersObject);

    let productsNameArrayFilter = productsNameArray.filter((product) => {
      return product !== e.target.dataset.name;
    });

    let filledMeasurementsArray = filledMeasurements.filter((product) => {
      return product !== e.target.dataset.name;
    });

    let productsArrayObjects = productsArrayObject.filter((product) => {
      return product.name !== e.target.dataset.name;
    });


    //  productsArrayObject.push(productsArrayObjects)
    // setProductsArrayObject(productsArrayObjects);

    delete groupOrderMeasurements[e.target.dataset.name];

    setGroupOrderMeasurements({ ...groupOrderMeasurements });

    setFilledMeasurements(filledMeasurementsArray);

    setProductsNameArray(productsNameArrayFilter);

    delete productsMeasurementArray[e.target.dataset.name];

    setProductsMeasurementArray({ ...productsMeasurementArray })

    if (e.target.dataset.name == 'suit') {
      setSuitProductsMeasurementArray({})
    }
    if (e.target.dataset.name == 'tuxedo') {
      setTuxedoProductsMeasurementArray({})
    }


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
    for (let x of ordersObject) {
      if (!x['styles']) {
        styleF = false
      }
    }

    setStylesFinished(styleF)
  };

  const handleStyleDataSave = async (e) => {
    let styleF = true
    for (let x of orders) {
      if (!x['styles']) {
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
  console.log("user: ", user)

  const handleClose2 = async (e) => {
    setOpen2(false);
  };
  const handleSaveGroupOrder = async () => {
    const groupOrderObject = groupOrder

    const newOrderArray = orders
    for (let x of newOrderArray) {
      let justA = []
      if (x['styles'] && x['styles'].length == undefined) {
        justA.push(x['styles'])
        x['styles'] = justA
      }
    }

    groupOrderObject['order_items'] = newOrderArray
    groupOrderObject['product_quantity'] = totalQuantity
    groupOrderObject['customers'] = customerArray
    groupOrderObject['retailer_id'] = user.data.id
    groupOrderObject['retailerName'] = user.data.retailer_name
    groupOrderObject['retailer_code'] = user.data.retailer_code
    if (groupOrder.name === "") {
      console.log("1")
      alert("please fill group order name");
    } else if (groupOrder.customer_quantity === 0) {
      console.log("2")
      alert("please fill customer quantity");
    } else if (orders.length > 0 && orders.length !== null && stylesFinished) {
      console.log("3")

      if (orders[0].styles !== undefined) {

        if (id === "") {
          const res = await axiosInstance.post("/groupOrders/create", {
            group: groupOrderObject,
            token: user.data.token,
          });




          if (res.data.status == true) {
            setId(res.data.data._id)
            setSnackbarOpen(true);
            setSuccess(true);
            setsuccessMsg(res.data.message);
            setshowCustomerAddButton(true)
          } else {
            setSnackbarOpen(true);
            setError(true);
            setErrorMsg(res.data.message);
          }
        } else {

          groupOrderObject['retailer_id'] = groupOrder['retailer_id']
          groupOrderObject['retailerName'] = groupOrder['retailerName']
          groupOrderObject['retailer_code'] = groupOrder['retailer_code']
          // console.log("groupOrder Object: ", groupOrderObject['order_items'][1]['styles'][0][0]['suit_0'])
          const res1 = await axiosInstance.post(
            "/groupOrders/updateProductStyle/" + id,
            {
              group: groupOrderObject,
              token: user.data.token,
            }
          );

          if (res1.data.status == true) {
            setSnackbarOpen(true);
            setSuccess(true);
            setsuccessMsg(res1.data.message);
            fetchOrder(id)
            if (customerArray.length == groupOrderObject['customer_quantity']) {
              setshowCustomerAddButton(false)
            }
          } else {
            setSnackbarOpen(true);
            setError(true);
            setErrorMsg(res1.data.message);
          }
        }
      } else {
        setSnackbarOpen(true);
        setError(true);
        setErrorMsg("Please fill all the necessary details!");
      }
    } else {
      console.log("dfbsfndsk")
      setSnackbarOpen(true);
      setError(true);
      setErrorMsg("Please fill all the necessary details!");
    }
  };

  const handleRepeatGroupOrder = async () => {
    // console.log()
    const groupOrderObject = JSON.parse(JSON.stringify(groupOrder))

    groupOrderObject['order_items'] = orders
    groupOrderObject['product_quantity'] = jacketCount
    groupOrderObject['customers'] = customerArray
    groupOrderObject['retailer_id'] = user.data.id
    groupOrderObject['retailerName'] = user.data.retailer_name
    groupOrderObject['retailer_code'] = user.data.retailer_code
    if (groupOrder.name === "") {
      alert("please fill group order name");
    } else if (groupOrder.customer_quantity === 0) {
      alert("please fill customer quantity");
    } else if (orders.length > 0 && orders.length !== null) {

      if (orders[0].styles !== undefined) {
        // if (id === "") {
        const res = await axiosInstance.post("/groupOrders/create", {
          group: groupOrderObject,
          token: user.data.token,
        });

        setId(res.data.data._id)

        if (res.data.status == true) {
          setSnackbarOpen(true);
          setSuccess(true);
          setsuccessMsg(res.data.message);
          setshowCustomerAddButton(true)
        } else {
          setSnackbarOpen(true);
          setError(true);
          setErrorMsg(res.data.message);
        }
        // } else {
        //   const res1 = await axiosInstance.post(
        //     "/groupOrders/updateProductStyle/" + id,
        //     {
        //       group: groupOrderObject,
        //       token: user.data.token,
        //     }
        //   );

        //   if (res1.data.status == true) {
        //     setSnackbarOpen(true);
        //     setSuccess(true);
        //     setsuccessMsg(res1.data.message);
        //     fetchOrder(id)
        //     if(customerArray.length == groupOrderObject['customer_quantity']){
        //       setshowCustomerAddButton(false)
        //     }
        //   } else {
        //     setSnackbarOpen(true);
        //     setError(true);
        //     setErrorMsg(res1.data.message);
        //   }
        // }
      } else {
        alert("please fill product styling");
      }
    } else {
      alert("please select any product");
    }
  };

  const handleCloseAction = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
    setError(false);
  };
  const handlePlaceGroupOrder = async () => {
    const validation = newCustomerArray.every(
      (item) => item.firstname && item.lastname && item.gender
    );

    if (validation === false) {
      setSnackbarOpen(true);
      setError(true);
      setErrorMsg("Please fill all customer details and measurements!!");
    } else {
      let res2 = await axiosInstance.post(
        `/groupOrders/placeGroupOrder/` + id,
        {
          token: user.data.token,
          order: groupOrder
        }
      );
      if (res2.data.status == "success") {
        const sendMail = await axiosInstance.post('groupOrders/sendMail', {
          token: user.data.token,
          order: res2.data.data['_id']
        })
        setSnackbarOpen(true);
        setSuccess(true);
        setsuccessMsg("Group order place Successfully........");
        navigate("/retailer/viewGroupOrder");
      } else {
        setSnackbarOpen(true);
        setError(true);
        setErrorMsg(res2.data.message);
      }
    }
  };
  console.log("group: ", groupOrder)

  const action = (
    <React.Fragment>
      <Button color="secondary" size="small" onClick={handleClose}>
        UNDO
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleCloseAction}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </React.Fragment>
  );

  const handleCloseNewCustomerForm = () => {
    setOpenCustomerForm(false)
  }

  const handleOpenNewCustomerForm = () => {
    if (stylesFinished) {
      for (let x of orders) {
        measurementsFinished[x['item_name']] = false
      }
      setMeasurementsFinished({ ...measurementsFinished })
      setOpenCustomerForm(true)
    } else {
      setSnackbarOpen(true);
      setError(true);
      setErrorMsg("Please fill all the Stylings First!");
    }
  }

  const handleManageCustomer = (cid) => {
    setCustomerID(cid)
    setOpenCustomerForm(true)
  }

  const handleCustomerQuantity = (e) => {
    if (e.target.value < 2) {
      setSnackbarOpen(true);
      setError(true);
      setErrorMsg("Customers Quantity cannot be less than 2");
    } else {
      if (e.target.value < customerArray.length) {
        setSnackbarOpen(true);
        setError(true);
        setErrorMsg("Cannot decrease the customer quantity. First remove customers");
      }
      else {
        setGroupOrder({
          ...groupOrder,
          customer_quantity: e.target.value,
        })
        if (e.target.value > customerArray.length) {
          setshowCustomerAddButton(true)
        } else {
          setshowCustomerAddButton(false)
        }

      }
    }



  }


  // ======================static functions============================
  // ==================================================================
  const fetchOrder = async (gid) => {
    console.log("fetch order running")
    const res = await axiosInstance.post('/groupOrders/fetchDatag/' + gid, { token: user.data.token })
    setGroupOrderCustomers(res.data.data[0]['customers'])
    setGroupOrder(res.data.data[0])
    setOrders(res.data.data[0]['order_items'])
    for (let x of res.data.data[0]['order_items']) {
      if (!productsNameArray.includes(x['item_name'])) {
        productsNameArray.push(x['item_name'])
      }

    }
    // console.log(productsMeasurementArray)
    if (!id.length > 0) {
      setId(res.data.data[0]['_id'])
    }
    setTotalQuantity(res.data.data[0]['product_quantity'])
    setJacketCount(res.data.data[0]['product_quantity'])
    for (let x of res.data.data[0]['customers']) {
      if (!customerArray.includes(x._id)) {
        customerArray.push(x._id)
      }
    }
    if (res.data.data[0]['customers'].length < res.data.data[0]['customer_quantity']) {
      setshowCustomerAddButton(true)
    }
    setCustomerArray([...customerArray])
    setProductsNameArray([...productsNameArray])

  }
  // ==================================================================
  // ==================================================================
  return (
    <>
      <div className="order-customer">
        <div className="step4_wrapper_DM">
          <div className="step-4rushorderbox">
            <div className="step4BOXED">
              <h3 className="steper-title">Group Order New</h3>
            </div>
          </div>
          <div className="factory-user-from-NM pd-15">
            <form>
              <div className="form-group">
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Group Order Name <span className="red-required">*</span>
                    </p>
                    {
                      user && user.data.role == "administrator" ?
                        <p style={{ color: "black", fontSize: "16px" }}>{groupOrder.name}</p>
                        :
                        <input
                          className="searchinput"
                          type="text"
                          value={groupOrder.name}
                          onChange={(e) =>
                            setGroupOrder({ ...groupOrder, name: e.target.value })
                          }
                        />
                    }
                  </div>
                </div>
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Number OF Customer <span className="red-required">*</span>
                    </p>

                    {
                      user && user.data.role == "administrator" ?
                        <p style={{ color: "black", fontSize: "16px" }}>{groupOrder.customer_quantity}</p>
                        :
                        <input
                          className="searchinput"
                          type="number"
                          value={groupOrder.customer_quantity}
                          onChange={(e) => handleCustomerQuantity(e)}

                        // disabled={
                        //   !id || groupOrder.customer_quantity == 0 ? false : true
                        // }
                          min="2"
                        />
                    }

                  </div>
                </div>
                <div className="col">

                  <div className="searchinput-inner">
                    <p>
                      Product <span className="red-required">*</span>
                    </p>

                    {
                      user && user.data.role == "administrator" ?
                        <p style={{ color: "black", fontSize: "16px" }}>
                          {
                          productsNameArray.length > 0
                          ?
                          <ul>
                            {productsNameArray.map((singleProducts, index) => (
                              <li key={index}>{singleProducts}</li>
                            ))}
                          </ul>
                          :
                          <></>
                        }</p>
                        :

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
                    }
                  </div>
                  {/* <select
                      className="searchinput"
                      onChange={handleProduct}
                      disabled={!id ? false : true}
                    >
                      {productName.length > 0 ? (
                        <option>Select a Product</option>
                      ) : (
                        <option selected>Select a Product</option>
                      )}

                      {productsDrop.map((product) => {
                        if (!productsNameArray.includes(product.name)) {
                          return (
                            <option value={product._id}>
                              {product.name.charAt(0).toUpperCase() +
                                product.name.slice(1)}
                            </option>
                          );
                        }
                      })}
                    </select> */}
                </div>

              </div>
            </form>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>fabric & styling</th>
                <th> QTY </th>
                {!id ? <th>Delete</th> : <></>}
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((products, i) => {
                  return (
                    <tr key={i}>
                      <td>{products["item_name"].toUpperCase()}</td>
                      <td className="styleFabricsTD">
                        {" "}
                        <span
                          value={products.item_name}
                          data-name={products.item_name}
                          onClick={
                            products["quantity"] > 0 ? handleManageStyle : handleClick
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
                      {
                      user && user.data.role == "administrator" ?
                        <p style={{ color: "black", fontSize: "16px" }}>{products.quantity}</p>
                        :
                        <>
                        <Button
                          className="minusIc"
                          data-name={products["item_name"]}
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
                          onClick={IncNum}
                        >
                          +
                        </Button>
                        </>
                    }
                       
                      </td>

                      <td>
                        {!id ? (
                          <button
                            value={products.item_name}
                            data-name={products.item_name}
                            onClick={(event) => handleDelete(event)}
                            className="delete-Btn"
                          >
                            Delete
                          </button>
                        ) : (
                          <></>
                        )}
                        {/* <button
                          value={products.item_name}
                          data-name={products.item_name}
                          onClick={(event) => handleDelete(event)}
                          className="delete-Btn"
                        >
                          Delete
                        </button> */}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td style={{ color: "red" }}>
                    Please select product here.....
                  </td>
                </tr>
              )}

              <tr>
                <td className="undrLine"> </td>
                <td className="undrLine"> </td>
                <td className="undrLine"> </td>
                <td className="undrLine">
                  <strong className="pl_20">
                    Total = <strong className="pl_20">{totalQuantity}</strong>{" "}
                  </strong>
                </td>
                {/* <td className="text-center undrLine">
                
                </td> */}
              </tr>
            </tbody>
          </table>

          {/* {showCustomerTable > 0 ? (
            <>
              <div className="step-4rushorderbox">
                <div className="step4BOXED">
                  <h3 className="steper-title">Manage Customer</h3>
                  <p className="title-name-Short">
                    <strong>
                      {groupOrder !== undefined ? `${groupOrder.name}` : ""}
                    </strong>
                  </p>
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th> S.NO.</th>
                    <th> Customer Name </th>
                    <th> Manage Customer </th>
                    <th> Form Status </th>
                  </tr>

                  {newCustomerArray.length > 0 &&
                    newCustomerArray.map((data, index) => {
                      return (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            <span>{data.firstname ? data.fullname : "--"}</span>
                          </td>
                          <td>
                            <span
                              onClick={(event) =>
                                handleCustomer(event, data._id, index)
                              }
                            >
                              {data.firstname ? (
                                <span style={{ color: "green" }}>Manage</span>
                              ) : (
                                <span style={{ color: "red" }}>Missing</span>
                              )}
                            </span>
                          </td>
                          <td>
                            {data.firstname ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <CancelIcon color="error" />
                            )}
                          </td>
                          <td colSpan="2">
                            <Button
                              className="delete-icon"
                              onClick={(event) =>
                                handleRemoveItem(event, data._id)
                              }
                            >
                              {" "}
                              <DeleteIcon />{" "}
                            </Button>{" "}
                          </td>
                        </tr>
                      );
                    })}
                </thead>
              </table>
            </>
          ) : (
            <></>
          )} */}

          <div className="boxedTWo mt-15" style={{ borderBottom: "solid 1px #C2C2C3", paddingBottom: "15px" }}>
            {location.pathname.split("/")[2] == 'repeatGroupOrderT'
              ?
              <button
                type="button"
                className="outline-back-btn"
                onClick={handleRepeatGroupOrder}
              >
                Repeat Order
              </button>
              :

              <button
                type="button"
                className="outline-back-btn"
                onClick={handleSaveGroupOrder}
              >
                Save Draft
              </button>}
            {!groupOrder['orderPlaced'] && groupOrder['customers'] && groupOrder['customers'].length == groupOrder.customer_quantity ? (
              <button
                type="button"
                className="custom-btn ml-15"
                onClick={handlePlaceGroupOrder}
              >
                Place Group Order
              </button>
            ) : (
              <></>
            )}
            {/* {showCustomerTable > 0 ? (
              <button
                type="button"
                className="custom-btn ml-15"
                onClick={handlePlaceGroupOrder}
              >
                Place Group Order
              </button>
            ) : (
              <></>
            )} */}
          </div>

          <div className="customer-filled-div" style={{ display: "flex", alignItems: "center", justifyContent: "end", padding: "20px 10px" }}><span><strong>Customer Filled :- {groupOrder['customers'] && groupOrder['customer_quantity'] ? groupOrder['customers'].length + "/" + groupOrder['customer_quantity'] : "0/0"}</strong></span></div>


          <div style={{ display: "flex", alignItems: "center", justifyContent: "end", padding: "20px 10px" }}>
            {
              showAddCustomerButton
                ?
                <div >
                  <button
                    type="button"
                    className="outline-back-btn"
                    onClick={handleOpenNewCustomerForm}
                  >
                    Add Customer
                  </button>
                </div>
                :
                <></>
            }
          </div>
          <div>
            <Dialog
              onClose={handleClose2}
              open={open2}
              className={
                isActive2 ? "rigth-sideModel mui_show missingFabricDailogueBox" : "rigth-sideModel missingFabricDailogueBox"
              }
            >
              <MissingFabric
                saveData={handleStyleDataSave}
                data={product_name}
                orders={orders}
                setOrders={setOrders}
                jacketCount={jacketCount}
                setJacketCount={setJacketCount}
                setTotalQuantity={setTotalQuantity}
              />
            </Dialog>
          </div>
          <div>
            <Dialog
              onClose={handleCloseNewCustomerForm}
              open={openCustomerForm}
              className={
                openCustomerForm ? "rigth-sideModel mui_show" : "rigth-sideModel"
              }
            >
              <NewCustomer
                setOpenCustomerForm={setOpenCustomerForm}
                productsMeasurementArray={productsMeasurementArray}
                suitProductsMeasurementArray={suitProductsMeasurementArray}
                tuxedoProductsMeasurementArray={tuxedoProductsMeasurementArray}
                orders={orders}
                customerID={customerID}
                setCustomerID={setCustomerID}
                customerArray={customerArray}
                setCustomerArray={setCustomerArray}
                handleSaveGroupOrder={handleSaveGroupOrder}
                measurementsFinished={measurementsFinished}
                setMeasurementsFinished={setMeasurementsFinished}

              />
            </Dialog>
          </div>
          <div>
            <Customers
              groupOrderCustomers={groupOrderCustomers}
              setGroupOrderCustomers={setGroupOrderCustomers}
              customerArray={customerArray}
              setCustomerArray={setCustomerArray}
              setshowCustomerAddButton={setshowCustomerAddButton}
              customerID={customerID}
              handleManageCustomer={handleManageCustomer}
            />
          </div>

        </div>
      </div>
      {success && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2000}
          onClose={handleCloseAction}
        >
          <Alert
            onClose={handleCloseAction}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2000}
          onClose={handleCloseAction}
          action={action}
        >
          <Alert
            onClose={handleCloseAction}
            severity="error"
            sx={{ width: "100%" }}
          >
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}
