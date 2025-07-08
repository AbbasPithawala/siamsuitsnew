// import React from "react";
// import "./factory.css";
// import { useState, useEffect, useContext } from "react";
// import { axiosInstance } from "./../../../../config";
// import { Context } from "../../../../context/Context";
// import Button from "@mui/material/Button";
// import Dialog from "@mui/material/Dialog";
// import Snackbar from "@mui/material/Snackbar";
// import MuiAlert from "@mui/material/Alert";

// const Alert = React.forwardRef(function Alert(props, ref) {
//   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// });

// export default function ManagePaymentCategories() {
//   const [extraPaymentCategories, setExtraPaymentCategories] = useState([]);
//   const [categoryID, setCategoryID] = useState("");
//   const [products, setProducts] = useState([]);
//   const [product, setProduct] = useState("");
//   const [features, setfeatures] = useState([]);
//   const [feature, setfeature] = useState("");
//   const [stylesValues, setStylesValues] = useState([]);
//   const [isGroupStyle, setIsGroupStyle] = useState(false);
//   const [styleOptions, setStyleOptions] = useState({});
//   const [extraPayementCategoryObject, setExtraPaymentCategoryObject] = useState(
//     {}
//   );
//   const [editing, setEditing] = useState(false);
//   const [groupStylesValues, setGroupStylesValues] = useState([]);
//   const [groupStylesValue, setGroupStylesValue] = useState("");
//   const [stylesValue, setStylesValue] = useState("");
//   const [extraCatName, setExtraCatName] = useState("");
//   const [cost, setCost] = useState("");
//   const [open, setOpen] = useState(false);
//   const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
//   const [success, setSuccess] = useState(false);
//   const [error, setError] = useState(false);
//   const [successMsg, setSuccessMsg] = useState(false);
//   const [errorMsg, setErrorMsg] = useState(false);
//   const { user } = useContext(Context);

//   const fetchProducts = async () => {
//     const res = await axiosInstance.post("product/fetchAll/0/0", {
//       token: user.data.token,
//     });
//     setProducts(res.data.data);
//   };

//   const fetchFeatures = async () => {
//     const res = await axiosInstance.post("/feature/fetchAll/0/0", {
//       token: user.data.token,
//     });
//     setfeatures(res.data.data);
//   };

//   useEffect(() => {
//     fetchProducts();
//     fetchFeatures();
//     fetchExtraPaymentCategories();
//   }, []);

//   const handleSetProduct = (e) => {
//     setProduct(e.target.value);
//     extraPayementCategoryObject["product"] = e.target.value;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//   };

//   const handleChoice = async (id) => {
//     setfeature(id);
//     extraPayementCategoryObject["feature"] = id;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//     fetchStyles(id)
//   };

//   const handleStyleValue = (e) => {
//     extraPayementCategoryObject["style"] = e.target.value;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//     if (isGroupStyle) {
//       const styleOptionsArray = stylesValues.filter(
//         (values) => values._id == e.target.value
//       );
//       setStyleOptions(styleOptionsArray[0]);
//     } else {
//       setStyleOptions({});
//     }
//   };

//   const handleOptionValue = (e) => {
//     extraPayementCategoryObject[e.target.dataset.name] = e.target.value;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//   };

//   const handleSetExtraCategoryName = (e) => {
//     setExtraCatName(e.target.value);
//     extraPayementCategoryObject["name"] = e.target.value;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//   };
//   const handleSetExtraCategoryCost = (e) => {
//     setCost(e.target.value);
//     extraPayementCategoryObject["cost"] = e.target.value;
//     setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
//   };


//   const handleOpenAddNewPaymentCategory = () => {
//     setExtraPaymentCategoryObject({})
//     setOpen(true)
//   }

//   const handleSubmit = async () => {
//     if (
//       !extraPayementCategoryObject["product"].length > 0 ||
//       !extraPayementCategoryObject["feature"].length > 0 ||
//       !extraPayementCategoryObject["style"].length > 0 ||
//       !extraPayementCategoryObject["name"].length > 0 ||
//       !extraPayementCategoryObject["cost"].length > 0
//     ) {
//       setSuccess(false);
//       setError(true);
//       setErrorMsg("Please Fill all the details!");
//     } else {
//       const res = await axiosInstance.post("/extraPaymentCategory/create", {
//         token: user.data.token,
//         extraPaymentCategory: extraPayementCategoryObject,
//       });
//       if (res.data.status) {
//         setError(false);
//         setSuccess(true);
//         setSuccessMsg(res.data.message);
//         fetchExtraPaymentCategories();
//       } else {
//         setSuccess(false);
//         setError(true);
//         setErrorMsg(res.data.message);
//       }
//     }
//   };

//   const handleEdit = async () => {
//     if (
//       !extraPayementCategoryObject["product"].length > 0 ||
//       !extraPayementCategoryObject["feature"].length > 0 ||
//       !extraPayementCategoryObject["style"].length > 0 ||
//       !extraPayementCategoryObject["name"].length > 0 ||
//       !extraPayementCategoryObject["cost"].length > 0
//     ) {
//       setSuccess(false);
//       setError(true);
//       setErrorMsg("Please Fill all the details!");
//     } else {
//       const res = await axiosInstance.put(
//         "/extraPaymentCategory/update/" + categoryID,
//         {
//           token: user.data.token,
//           extraPaymentCategory: extraPayementCategoryObject,
//         }
//       );
//       if (res.data.status == true) {
//         setError(false);
//         setSuccess(true);
//         setSuccessMsg(res.data.message);
//         fetchExtraPaymentCategories();
//         setEditing(false)
//       } else {
//         setSuccess(false);
//         setError(true);
//         setErrorMsg(res.data.message);
//       }
//     }
//   };

  
//   const handleClose = (event, reason) => {
//     if (reason === "clickaway") {
//       return;
//     }
//     setSuccess(false);
//     setOpen(false);
//   };

//   const handleOpenDeleteDialog = (e) => {
//     setCategoryID(e.target.dataset.id);
//     setOpenDeleteDialog(true);
//   };

//   const handleCloseDeleteDialog = () => {
//     setCategoryID("");
//     setOpenDeleteDialog(false);
//   };

//   const handleOpenEditDialog = (e) => {
//     setCategoryID(e.target.dataset.id);
//     const thisCategory = extraPaymentCategories.filter(
//       (cat) => cat["_id"] == e.target.dataset.id
//     );
//     const categoryObject = {
//       name: thisCategory[0]["name"],
//       feature: thisCategory[0]["feature"]["_id"],
//       style: thisCategory[0]["style"]["_id"],
//       product: thisCategory[0]["product"]["_id"],
//       cost: thisCategory[0]["cost"],
//     };
    
//     if (thisCategory[0]["option_value"]) {
//       categoryObject["option_value"] = thisCategory[0]["option_value"];

//       if (isGroupStyle) {
//         const styleOptionsArray = stylesValues.filter(
//           (values) => values._id == thisCategory[0]["style"]["_id"]
//         );
//         setStyleOptions(styleOptionsArray[0]);
//       } else {
//         setStyleOptions({});
//       }
//     }else{
//       setStyleOptions({});
//     }
//     fetchStyles(thisCategory[0]["feature"]["_id"])
    
//     setExtraPaymentCategoryObject(categoryObject);
//     setEditing(true);
//     setOpen(true);
//   };

//   const handleDeleteExtraPaymentCategories = async () => {
//     const res = await axiosInstance.post(
//       "/extraPaymentCategory/delete/" + categoryID,
//       { token: user.data.token }
//     );
//     if (res.data.status) {
//       setExtraPaymentCategories(res.data.data);
//       setError(false);
//       setSuccess(true);
//       setSuccessMsg(res.data.message);
//     } else {
//       setSuccess(false);
//       setError(true);
//       setErrorMsg(res.data.message);
//     }
//   };


//   // =========================static==================================
//   // =================================================================
//   const fetchExtraPaymentCategories = async () => {
//     const res = await axiosInstance.post("/extraPaymentCategory/fetchAll", {
//       token: user.data.token,
//     });
//     if (res.data.status) {
//       setExtraPaymentCategories(res.data.data);
//       setError(false);
//       setSuccess(true);
//       setSuccessMsg(res.data.message);
//     } else {
//       setSuccess(false);
//       setError(true);
//       setErrorMsg(res.data.message);
//     }
//   };


//   const fetchStyles = async (id) => {
//     const res = await axiosInstance.post(`/feature/fetch/${id}`, {
//       token: user.data.token,
//     });

//     setStylesValues(res.data.data[0]["styles"]);

//     for (let x of res.data.data[0]["styles"]) {
//       if (x["style_options"].length > 0) {
//         setIsGroupStyle(true);
        
//         break;
//       } else {
//         setIsGroupStyle(false);
//         setStyleOptions({});
//       }
//     }
//   }
//   console.log(stylesValues)
//   console.log(extraPayementCategoryObject)
//   // =================================================================
//   // =================================================================
//   return (
//     <main className="main-panel">
//       <div className="content-wrapper">
//         <div className="order-table manage-page">
//           <div className="top-heading-title">
//             <strong>Manage Extra Payment Categories</strong>
//             <button
//               type="button"
//               className="custom-btn"
//               // onClick={() => setOpen(true)}
//               onClick={() => handleOpenAddNewPaymentCategory()}
//             >
//               <i className="fa-solid fa-plus"></i> Add Extra Payment Category
//             </button>
//           </div>
//           {extraPaymentCategories.length > 0 ? (
//             <table className="table">
//               <thead>
//                 <tr>
//                   <th>CATEGORY NAME</th>
//                   <th>PRODUCT</th>
//                   <th>POSITION</th>
//                   <th>STYLING</th>
//                   <th>COST</th>
//                   <th>OPTION</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {extraPaymentCategories.map((cat) => {
//                   return (
//                     <tr>
//                       <td style={{ textTransform: "capitalize" }}>
//                         {cat["name"]}
//                       </td>
//                       <td style={{ textTransform: "capitalize" }}>
//                         {cat["product"]["name"]}
//                       </td>
//                       <td style={{ textTransform: "capitalize" }}>
//                         {cat["feature"]["name"]}
//                       </td>
//                       <td style={{ textTransform: "capitalize" }}>
//                         {cat["style"]["name"]}
//                       </td>
//                       <td>{cat["cost"]}</td>
//                       <td>
//                         <strong>
//                           <Button
//                             style={{ color: "black" }}
//                             data-id={cat["_id"]}
//                             onClick={(e) => handleOpenEditDialog(e)}
//                             className="action"
//                           >
//                             Edit
//                           </Button>
//                           |{" "}
//                           <Button
//                             style={{ color: "black" }}
//                             data-id={cat["_id"]}
//                             onClick={(e) => handleOpenDeleteDialog(e)}
//                             className="action"
//                           >
//                             Delete
//                           </Button>
//                         </strong>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           ) : (
//             <>No Categories Found yet!</>
//           )}
//         </div>
//       </div>
//       <Dialog
//         open={open}
//         onClose={handleClose}
//         aria-labelledby="alert-dialog-title"
//         aria-describedby="alert-dialog-description"
//       >
//         <div className="order-table manage-page">
//           <div className="top-heading-title">
//             <strong> Add Extra Payment Category </strong>
//           </div>
//           <div className="factory-user-from-NM pd-15">
//             <div className="form-group">
//               <div className="col">
//                 <div className="searchinput-inner">
//                   <p>
//                     Product <span className="red-required">*</span>
//                   </p>
//                   <select
//                     className="searchinput"
//                     date-name="product"
//                     value={extraPayementCategoryObject["product"] ? extraPayementCategoryObject["product"] : ""}
//                     onChange={(e) => handleSetProduct(e)}
//                   >
//                     <option>Select Product</option>
//                     {products.map((product) => (
//                       <option value={product._id}>
//                         {product.name.charAt(0).toUpperCase() +
//                           product.name.slice(1)}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//               </div>
//               <div className="col">
//                 <div className="searchinput-inner">
//                   <p>
//                     Option Choice <span className="red-required">*</span>
//                   </p>
//                   <select
//                     className="searchinput"
//                     date-name="feature"
//                     value={extraPayementCategoryObject["feature"] ? extraPayementCategoryObject["feature"] : ""}
//                     onChange={(e) => handleChoice(e.target.value)}
//                   >
//                     <option>Select a Option Choice</option>
//                     {features.map((feature) => {
//                       if (feature.product_id == product || feature.product_id == extraPayementCategoryObject["product"]) {
//                         return (
//                           <option value={feature._id}>
//                             {feature["additional"] == true
//                               ? feature.name.charAt(0).toUpperCase() +
//                                 feature.name.slice(1) +
//                                 " (Yes)"
//                               : feature.name.charAt(0).toUpperCase() +
//                                 feature.name.slice(1) + "(No)"}  
//                           </option>
//                         );
//                       }
//                     })}
//                   </select>
//                 </div>
//               </div>
//               <div className="col">
//                 <div className="searchinput-inner">
//                   <p>
//                     Option Value <span className="red-required">*</span>
//                   </p>
//                   <select
//                     className="searchinput"
//                     date-name="style"
//                     value={extraPayementCategoryObject["style"] ? extraPayementCategoryObject["style"] : ""}
//                     onChange={(e) => handleStyleValue(e)}
//                   >
//                     <option>Select a Option Value</option>
//                     {stylesValues.map((stylesValue) => {
//                       if (stylesValue.feature_id == feature || stylesValue.feature_id == extraPayementCategoryObject["feature"]) {
//                         return (
//                           <option value={stylesValue._id}>
//                             {stylesValue.name.charAt(0).toUpperCase() +
//                               stylesValue.name.slice(1)}
//                           </option>
//                         );
//                       }
//                     })}
//                   </select>
//                 </div>
//               </div>
//               {Object.keys(styleOptions).length > 0 ? (
//                 <div className="col">
//                   <div className="searchinput-inner">
//                     <p>
//                       Option Value <span className="red-required">*</span>
//                     </p>
//                     <select
//                       className="searchinput"
//                       data-name="option_value"
//                       value={extraPayementCategoryObject["option_value"] ? extraPayementCategoryObject["option_value"] : ""}
//                       onChange={(e) => handleOptionValue(e)}
//                     >
//                       <option>Select a Option Value</option>
//                       {styleOptions["style_options"].map((options) => {
//                         return (
//                           <option value={options._id}>
//                             {options.name.charAt(0).toUpperCase() +
//                               options.name.slice(1)}
//                           </option>
//                         );
//                       })}
//                     </select>
//                   </div>
//                 </div>
//               ) : (
//                 <></>
//               )}
//               <div className="col">
//                 <div className="searchinput-inner">
//                   <p>
//                     Extra Category Name <span className="red-required">*</span>
//                   </p>
//                   <input
//                     className="searchinput"
//                     type="text"
//                     value={
//                       extraPayementCategoryObject["name"]
//                         ? extraPayementCategoryObject["name"]
//                         : ""
//                     }
//                     onChange={(e) => handleSetExtraCategoryName(e)}
//                   />
//                 </div>
//               </div>
//               <div className="col">
//                 <div className="searchinput-inner">
//                   <p>Cost</p>
//                   <input
//                     className="searchinput"
//                     type="email"
//                     value={
//                       extraPayementCategoryObject["cost"]
//                         ? extraPayementCategoryObject["cost"]
//                         : ""
//                     }
//                     onChange={(e) => handleSetExtraCategoryCost(e)}
//                   />
//                 </div>
//               </div>
//               {editing ? (
//                 <button onClick={handleEdit} className="custom-btn">
//                   Edit
//                 </button>
//               ) : (
//                 <button onClick={handleSubmit} className="custom-btn">
//                   SAVE
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </Dialog>
//       <Dialog
//         open={openDeleteDialog}
//         onClose={handleCloseDeleteDialog}
//         aria-labelledby="alert-dialog-title"
//         aria-describedby="alert-dialog-description"
//       >
//         <div className="order-table manage-page">
//           <div className="top-heading-title">
//             <strong> Add Extra Payment Category </strong>
//           </div>
//           <div className="factory-user-from-NM pd-15">
//             <div className="form-group">
//               <div>Are you sure you want to delete this ?</div>
//               <button
//                 onClick={handleDeleteExtraPaymentCategories}
//                 className="custom-btn"
//               >
//                 Delete
//               </button>
//             </div>
//           </div>
//         </div>
//       </Dialog>
//       {success && (
//         <Snackbar open={success} autoHideDuration={2000} onClose={handleClose}>
//           <Alert
//             onClose={handleClose}
//             severity="success"
//             sx={{ width: "100%" }}
//           >
//             {successMsg}
//           </Alert>
//         </Snackbar>
//       )}
//       {error && (
//         <Snackbar open={error} autoHideDuration={2000} onClose={handleClose}>
//           <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
//             {errorMsg}
//           </Alert>
//         </Snackbar>
//       )}
//     </main>
//   );
// }



import React from "react";
import "./factory.css";
import { Link } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { axiosInstance } from "./../../../../config";
import { Context } from "../../../../context/Context";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
// import { axiosInstance } from "./../../../../config";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManagePaymentCategories() {
  const [extraPaymentCategories, setExtraPaymentCategories] = useState([]);
  const [categoryID, setCategoryID] = useState("");
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState("");
  const [features, setfeatures] = useState([]);
  const [feature, setfeature] = useState("");
  const [stylesValues, setStylesValues] = useState([]);
  const [isGroupStyle, setIsGroupStyle] = useState(false);
  const [styleOptions, setStyleOptions] = useState({});
  const [extraPayementCategoryObject, setExtraPaymentCategoryObject] = useState(
    {}
  );
  const [editing, setEditing] = useState(false);
  const [groupStylesValues, setGroupStylesValues] = useState([]);
  const [groupStylesValue, setGroupStylesValue] = useState("");
  const [stylesValue, setStylesValue] = useState("");
  const [extraCatName, setExtraCatName] = useState("");
  const [cost, setCost] = useState("");
  const [open, setOpen] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const { user } = useContext(Context);

  const fetchProducts = async () => {
    const res = await axiosInstance.post("product/fetchAll/0/0", {
      token: user.data.token,
    });
    setProducts(res.data.data);
  };

  const fetchFeatures = async () => {
    const res = await axiosInstance.post("/feature/fetchAll/0/0", {
      token: user.data.token,
    });
    setfeatures(res.data.data);
  };

  useEffect(() => {
    fetchProducts();
    fetchFeatures();
    fetchExtraPaymentCategories();
  }, []);

  const handleSetProduct = (e) => {
    setProduct(e.target.value);
    extraPayementCategoryObject["product"] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
  };

  const handleChoice = async (id) => {
    setfeature(id);
    extraPayementCategoryObject["feature"] = id;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
    fetchStyles(id)
    // const res = await axiosInstance.post(`/feature/fetch/${id}`, {
    //   token: user.data.token,
    // });
    // setStylesValues(res.data.data[0]["styles"]);
    // // console.log(res.data.data)
    // for (let x of res.data.data[0]["styles"]) {
    //   if (x["style_options"].length > 0) {
    //     setIsGroupStyle(true);
    //     break;
    //   } else {
    //     setIsGroupStyle(false);
    //     setStyleOptions({});
    //   }
    // }
    // setGroupStylesValues(res.data.data[0]["styles"]["style_options"]);
  };

  console.log("is group style ", isGroupStyle)

  const handleStyleValue = (e) => {
    extraPayementCategoryObject["style"] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
    if (isGroupStyle) {
      const styleOptionsArray = stylesValues.filter(
        (values) => values._id == e.target.value
      );
      setStyleOptions(styleOptionsArray[0]);
    } else {
      setStyleOptions({});
    }
  };

  const handleOptionValue = (e) => {
    // console.log("vajsdsa b", e.target.dataset.name)
    extraPayementCategoryObject[e.target.dataset.name] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
  };

  const handleSetExtraCategoryName = (e) => {
    setExtraCatName(e.target.value);
    extraPayementCategoryObject["name"] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
  };

  const handleSetExtraCategoryThaiName = (e)=> {
    // setExtraCatName(e.target.value);
    extraPayementCategoryObject["thai_name"] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
  }
  const handleSetExtraCategoryCost = (e) => {
    setCost(e.target.value);
    extraPayementCategoryObject["cost"] = e.target.value;
    setExtraPaymentCategoryObject({ ...extraPayementCategoryObject });
  };

  const handleOpenAddNewPaymentCategory = () => {
    setExtraPaymentCategoryObject({})
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (
      !extraPayementCategoryObject["product"].length > 0 ||
      // !extraPayementCategoryObject["feature"].length > 0 ||
      // !extraPayementCategoryObject["style"].length > 0 ||
      !extraPayementCategoryObject["thai_name"].length > 0 ||
      !extraPayementCategoryObject["name"].length > 0 ||
      !extraPayementCategoryObject["cost"].length > 0
    ) {
      setSuccess(false);
      setError(true);
      setErrorMsg("Please Fill all the details!");
    } else {

      const res = await axiosInstance.post("/extraPaymentCategory/create", {
        token: user.data.token,
        extraPaymentCategory: extraPayementCategoryObject,
      });
      console.log(res.data);
      if (res.data.status) {
        setError(false);
        setSuccess(true);
        setSuccessMsg(res.data.message);
        fetchExtraPaymentCategories();
      } else {
        setSuccess(false);
        setError(true);
        setErrorMsg(res.data.message);
      }
    }
  };

  const handleEdit = async () => {
    if (
      !extraPayementCategoryObject["product"].length > 0 ||
      // !extraPayementCategoryObject["feature"].length > 0 ||
      // !extraPayementCategoryObject["style"].length > 0 ||
      !extraPayementCategoryObject["thai_name"].length > 0 ||
      !extraPayementCategoryObject["name"].length > 0 ||
      !extraPayementCategoryObject["cost"].length > 0
    ) {
      setSuccess(false);
      setError(true);
      setErrorMsg("Please Fill all the details!");
    } else {
      const res = await axiosInstance.put(
        "/extraPaymentCategory/update/" + categoryID,
        {
          token: user.data.token,
          extraPaymentCategory: extraPayementCategoryObject,
        }
      );
      if (res.data.status == true) {
        setError(false);
        setSuccess(true);
        setSuccessMsg(res.data.message);
        fetchExtraPaymentCategories();
        setEditing(false)
      } else {
        setSuccess(false);
        setError(true);
        console.log(res.data)
        setErrorMsg(res.data.message);
      }
    }
  };

  
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSuccess(false);
    setOpen(false);
  };

  const handleOpenDeleteDialog = (e) => {
    setCategoryID(e.target.dataset.id);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setCategoryID("");
    setOpenDeleteDialog(false);
  };

  const handleOpenEditDialog = (e) => {
    setCategoryID(e.target.dataset.id);
    const thisCategory = extraPaymentCategories.filter(
      (cat) => cat["_id"] == e.target.dataset.id
    );
    const categoryObject = {
      name: thisCategory[0]["name"],
      thai_name: thisCategory[0]["thai_name"],
      feature: thisCategory[0]["feature"] ? thisCategory[0]["feature"]["_id"] : "",
      style: thisCategory[0]["style"] ? thisCategory[0]["style"]["_id"] : "",
      product: thisCategory[0]["product"]["_id"],
      cost: thisCategory[0]["cost"],
    };
    
    if (thisCategory[0]["option_value"]) {
      categoryObject["option_value"] = thisCategory[0]["option_value"];
      
      // fetchStyleOptions()/////
    }
    if(categoryObject.feature.length > 0){
      
    fetchStyles(thisCategory[0]["feature"]["_id"])
    }
    
    setExtraPaymentCategoryObject(categoryObject);
    setEditing(true);
    setOpen(true);
  };

  const handleDeleteExtraPaymentCategories = async () => {
    const res = await axiosInstance.post(
      "/extraPaymentCategory/delete/" + categoryID,
      { token: user.data.token }
    );
    if (res.data.status) {
      setExtraPaymentCategories(res.data.data);
      setError(false);
      setSuccess(true);
      setSuccessMsg(res.data.message);
    } else {
      setSuccess(false);
      setError(true);
      setErrorMsg(res.data.message);
    }
  };


  // =========================static==================================
  // =================================================================
  const fetchExtraPaymentCategories = async () => {
    const res = await axiosInstance.post("/extraPaymentCategory/fetchAll", {
      token: user.data.token,
    });
    if (res.data.status) {
      setExtraPaymentCategories(res.data.data);
      setError(false);
      setSuccess(true);
      setSuccessMsg(res.data.message);
    } else {
      setSuccess(false);
      setError(true);
      setErrorMsg(res.data.message);
    }
  };


  const fetchStyles = async (id) => {
    const res = await axiosInstance.post(`/feature/fetch/${id}`, {
      token: user.data.token,
    });

    console.log("check ", res.data.data)
    setStylesValues(res.data.data[0]["styles"]);
    // console.log(res.data.data)
    for (let x of res.data.data[0]["styles"]) {
      if (x["style_options"].length > 0) {
        setIsGroupStyle(true);
        
        break;
      } else {
        setIsGroupStyle(false);
        setStyleOptions({});
      }
    }
  }
  // =================================================================
  // =================================================================
  // console.log(extraPayementCategoryObject);

  // console.log("features ", features)
  // console.log("styles ", stylesValues)
  return (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Manage Extra Payment Categories</strong>
            <button
              type="button"
              className="custom-btn"
              // onClick={() => setOpen(true)}
              onClick={() => handleOpenAddNewPaymentCategory()}
            >
              <i className="fa-solid fa-plus"></i> Add Extra Payment Category
            </button>
          </div>
          {extraPaymentCategories.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>CATEGORY NAME</th>
                  <th>Optional Thai Name</th>
                  <th>PRODUCT</th>
                  <th>POSITION</th>
                  <th>STYLING</th>
                  <th>COST</th>
                  <th>OPTION</th>
                </tr>
              </thead>
              <tbody>
                {extraPaymentCategories.map((cat) => {
                  return (
                    <tr>
                      <td style={{ textTransform: "capitalize" }}>
                        {cat["name"]}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {cat["thai_name"]}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {cat["product"]["name"]}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {cat["feature"] ? cat["feature"]["name"]: ""}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {cat["style"]? cat["style"]["name"] : ""}
                      </td>
                      <td>{cat["cost"]}</td>
                      <td>
                        <strong>
                          <Button
                            style={{ color: "black" }}
                            data-id={cat["_id"]}
                            onClick={(e) => handleOpenEditDialog(e)}
                            className="action"
                          >
                            Edit
                          </Button>
                          |{" "}
                          <Button
                            style={{ color: "black" }}
                            data-id={cat["_id"]}
                            onClick={(e) => handleOpenDeleteDialog(e)}
                            className="action"
                          >
                            Delete
                          </Button>
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <>No Categories Found yet!</>
          )}
        </div>
      </div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Add Extra Payment Category </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <div className="form-group">
              <div className="col">
                <div className="searchinput-inner">
                  <p>
                    Product <span className="red-required">*</span>
                  </p>
                  <select
                    className="searchinput"
                    date-name="product"
                    value={extraPayementCategoryObject["product"] ? extraPayementCategoryObject["product"] : ""}
                    onChange={(e) => handleSetProduct(e)}
                  >
                    <option>Select Product</option>
                    {products.map((product) => (
                      <option value={product._id}>
                        {product.name.charAt(0).toUpperCase() +
                          product.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col">
                <div className="searchinput-inner">
                  <p>
                    Option Choice <span className="red-required">*</span>
                  </p>
                  <select
                    className="searchinput"
                    date-name="feature"
                    value={extraPayementCategoryObject["feature"] ? extraPayementCategoryObject["feature"] : ""}
                    onChange={(e) => handleChoice(e.target.value)}
                  >
                    <option>Select a Option Choice</option>
                    {features.map((feature) => {
                      if (feature.product_id == product || feature.product_id == extraPayementCategoryObject["product"]) {
                        return (
                          <option value={feature._id}>
                            {feature["additional"] == true
                              ? feature.name.charAt(0).toUpperCase() +
                                feature.name.slice(1) +
                                " (Yes)"
                              : feature.name.charAt(0).toUpperCase() +
                                feature.name.slice(1) + "(No)"}  
                          </option>
                        );
                      }
                    })}
                  </select>
                </div>
              </div>
              <div className="col">
                <div className="searchinput-inner">
                  <p>
                    Option Value <span className="red-required">*</span>
                  </p>
                  <select
                    className="searchinput"
                    date-name="style"
                    value={extraPayementCategoryObject["style"] ? extraPayementCategoryObject["style"] : ""}
                    onChange={(e) => handleStyleValue(e)}
                  >
                    <option>Select a Option Value</option>
                    {stylesValues.map((stylesValue) => {
                      if (stylesValue.feature_id == feature || stylesValue.feature_id == extraPayementCategoryObject["feature"]) {
                        return (
                          <option value={stylesValue._id}>
                            {stylesValue.name.charAt(0).toUpperCase() +
                              stylesValue.name.slice(1)}
                          </option>
                        );
                      }
                    })}
                  </select>
                </div>
              </div>
              {Object.keys(styleOptions).length > 0 ? (
                <div className="col">
                  <div className="searchinput-inner">
                    <p>
                      Option Value <span className="red-required">*</span>
                    </p>
                    <select
                      className="searchinput"
                      data-name="option_value"
                      onChange={(e) => handleOptionValue(e)}
                    >
                      <option>Select a Option Value</option>
                      {styleOptions["style_options"].map((options) => {
                        return (
                          <option value={stylesValue._id}>
                            {options.name.charAt(0).toUpperCase() +
                              options.name.slice(1)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                <></>
              )}
              <div className="col">
                <div className="searchinput-inner">
                  <p>
                    Extra Category Name <span className="red-required">*</span>
                  </p>
                  <input
                    className="searchinput"
                    type="text"
                    value={
                      extraPayementCategoryObject["name"]
                        ? extraPayementCategoryObject["name"]
                        : ""
                    }
                    onChange={(e) => handleSetExtraCategoryName(e)}
                  />
                </div>
              </div>
              <div className="col">
                <div className="searchinput-inner">
                  <p>
                    Extra Category Thai Name <span className="red-required">*</span>
                  </p>
                  <input
                    className="searchinput"
                    type="text"
                    value={
                      extraPayementCategoryObject["thai_name"]
                        ? extraPayementCategoryObject["thai_name"]
                        : ""
                    }
                    onChange={(e) => handleSetExtraCategoryThaiName(e)}
                  />
                </div>
              </div>
              <div className="col">
                <div className="searchinput-inner">
                  <p>Cost</p>
                  <input
                    className="searchinput"
                    type="email"
                    value={
                      extraPayementCategoryObject["cost"]
                        ? extraPayementCategoryObject["cost"]
                        : ""
                    }
                    onChange={(e) => handleSetExtraCategoryCost(e)}
                  />
                </div>
              </div>
              {editing ? (
                <button onClick={handleEdit} className="custom-btn">
                  Edit
                </button>
              ) : (
                <button onClick={handleSubmit} className="custom-btn">
                  SAVE
                </button>
              )}
            </div>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong> Add Extra Payment Category </strong>
          </div>
          <div className="factory-user-from-NM pd-15">
            <div className="form-group">
              <div>Are you sure you want to delete this ?</div>
              <button
                onClick={handleDeleteExtraPaymentCategories}
                className="custom-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Dialog>
      {success && (
        <Snackbar open={success} autoHideDuration={2000} onClose={handleClose}>
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
        <Snackbar open={error} autoHideDuration={2000} onClose={handleClose}>
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
