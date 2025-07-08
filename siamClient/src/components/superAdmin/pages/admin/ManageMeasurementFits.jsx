import React from "react";
import "./admin.css";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Tooltip from "@mui/material/Tooltip";
import FadeLoader from "react-spinners/FadeLoader";

export default function ManageMeasurementFits() {
  const { user } = useContext(Context);
  const [products, setProducts] = useState([]);
  const [customFits, setCustomFits] = useState([]);
  const [productFittingTable, setProductFittingTable] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProducts = async () => {
      const res = await axiosInstance.post("/product/fetchAll/0/0", {
        token: user.data.token,
      });
      const res2 = await axiosInstance.post("/customFittings/fetchAll", {
        token: user.data.token,
      });
      setProducts(res.data.data);
      setCustomFits(res2.data.data);
      setLoading(false);
      const newArray = [];
      for (let x of res.data.data) {
        let newObject = x;
        let arrayOfFits = [];
        if (res2.data.data != null) {
          for (let y of res2.data.data) {
            if (x._id == y.product_id) {
              arrayOfFits.push(y.fitting_name);
            }
            newObject.fittings = arrayOfFits;
          }
        } else {
          newObject.fittings = [];
        }

        newArray.push(newObject);
      }
      setProductFittingTable(newArray);
    };
    fetchProducts();
  }, []);

  const [data, setData] = useState();



  const handleProduct = async (e) => {
    const newArray = [];
    if (e.target.value != "all") {
      for (let x of products) {
        if (x._id == e.target.value) {
          let newObject = x;
          let arrayOfFits = [];
          if (customFits != null) {
            for (let y of customFits) {
              if (x._id == y.product_id) {
                arrayOfFits.push(y.fitting_name);
              }
              newObject.fittings = arrayOfFits;
            }
          } else {
            newObject.fittings = [];
          }

          newArray.push(newObject);
        }
      }
      setProductFittingTable(newArray);
    } else if (e.target.value == "all") {
      for (let x of products) {
        let newObject = x;
        let arrayOfFits = [];
        if (customFits != null) {
          for (let y of customFits) {
            if (x._id == y.product_id) {
              arrayOfFits.push(y.fitting_name);
            }
            newObject.fittings = arrayOfFits;
          }
        } else {
          newObject.fittings = [];
        }

        newArray.push(newObject);
      }
      setProductFittingTable(newArray);
    }
  };

  const handleViewProductFitting = async (e) => {
    // console.log(e.target.name)
  };

  return loading ? (
    <>
      <div className="spinnerStyle">
        <FadeLoader color="#1d81d2" />
      </div>
    </>
  ) : (
    <main className="main-panel">
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Manage Measurement Fits</strong>
            <Link to="/admin/addMeasurementFit" className="custom-btn">
              {" "}
              <i className="fa-solid fa-plus"></i> Add New Measurement Fits{" "}
            </Link>
          </div>

          <div className="searchstyle searchstyle-two">
            <div className="form-group row ">
              <div className="col-md-4">
                <div className="searchinput-inner">
                  <p>
                    Product <span className="red-required">*</span>
                  </p>
                  <select className="searchinput" onChange={handleProduct}>
                    <option value="all">Select a Product</option>

                    {products.map((product, i) => (
                      <option key={i} value={product._id}>
                        {product.name.charAt(0).toUpperCase() +
                          product.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>PRODUCT</th>
                <th>SIZE</th>
                <th>OPTION</th>
              </tr>
            </thead>
            <tbody>
              {productFittingTable.map((products, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{products.name.charAt(0).toUpperCase() + products.name.slice(1)}</td>
                  <td>
                    {products.fittings.length > 0
                      ? products.fittings.join(",  ")
                      : "--"}
                  </td>
                  <td>
                    <strong>
                      {products.fittings.length > 0 ? (
                        <Tooltip title="View fittings">
                          <Link
                            to={`/admin/productMeasurementFit/${products._id}`}
                            className="action"
                          >
                            <RemoveRedEyeIcon color="primary"></RemoveRedEyeIcon>
                          </Link>
                        </Tooltip>
                      ) : (
                        <Tooltip title="No fittings to show">
                          <Link to="#" className="action">
                            <VisibilityOffIcon color="warn"></VisibilityOffIcon>
                          </Link>
                        </Tooltip>
                      )}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
