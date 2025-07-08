import React, { useState, useEffect, useContext } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Button } from "@mui/material";
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';


export default function Measurements({
  product_name,
  customFittings,
  customerMeasurements, setCustomerMeasurements,
  productMeasurements, setProductMeasurements,
  measurements,
  totalMeasurements,
  isMeasurementFilled, setIsMeasurementFilled,
  draftMeasurementsObject,
  handleSaveMeasurements
}) {

  const elements = [
    "Measurement Name",
    "Value",
    "Adjustment Value",
    "Total Value",
    ""
  ];

  const handleCustomFitValue = async (e) => {
    const fitMeasure = customFittings.filter((x) => {
      return x.fitting_name == e.target.value;
    });

    customerMeasurements[product_name]["fitting_type"] = e.target.value;

    setCustomerMeasurements({ ...customerMeasurements });

    if (e.target.value == "0") {

      // setAdjustmentValueImmutable(false);

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

      // setAdjustmentValueImmutable(true);

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

  const handleOnClick = async (e) => {
    e.target.value = "";
  };

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

  return (
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
        {/* ============================================================ */}
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2} style={{padding: "5px 10px"}}>
            {[...Array(2)].map((_, i) => (
              <Grid item xs={6} key={i} style={{padding: "10px 20px"}}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    fontWeight: "bold",
                    background: "#f0f0f0",
                    borderRadius: "6px",
                  }}
                >
                  <p style={{ flex: 1 }}>Measurement Name</p>
                  <p style={{ flex: 1, textAlign: "center" }}>Value</p>
                  <p style={{ flex: 1, textAlign: "center" }}>Adjustment</p>
                  <p style={{ flex: 1, textAlign: "center" }}>Total Value</p>
                  <p style={{ flex: 0.5 }}></p>
                </div>
              </Grid>
            ))}

            {measurements.map((measurement) => (
              <Grid item xs={6} key={measurement.name} style={{padding: "10px 20px"}}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    background: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
                    marginBottom: "10px",
                  }}
                >
                  <p style={{ minWidth: "20%", fontWeight: "bold", fontSize: "14px" }}>
                    {measurement.name.charAt(0).toUpperCase() + measurement.name.slice(1)}
                  </p>

                  <input
                    type="number"
                    className="searchinput-measurement"
                    style={{
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #ccc",
                      outline: "none",
                      textAlign: "center",
                      margin: "5px"
                    }}
                    value={productMeasurements[measurement.name]?.value || 0}
                    name={measurement.name + "-value"}
                    min="0" // Ensures the user cannot manually enter a value below 0
                    onChange={(e) => {
                      const newValue = Math.max(0, Number(e.target.value)); // Prevents negative values
                      handleValueChange({ target: { name: e.target.name, value: newValue } });
                    }}
                    // onChange={handleValueChange}
                    onClick={handleOnClick}

                  />

                  <input
                    type="number"
                    className="searchinput-measurement"
                    style={{
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #ccc",
                      outline: "none",
                      textAlign: "center",
                      margin: "5px"
                    }}
                    value={productMeasurements[measurement.name]?.adjustment_value || 0}
                    name={measurement.name + "-adjustment_value"}
                    min="0" // Ensures the user cannot manually enter a value below 0
                    onChange={(e) => {
                      const newValue = Math.max(0, Number(e.target.value)); // Prevents negative values
                      handleValueChange({ target: { name: e.target.name, value: newValue } });
                    }}
                    onClick={handleOnClick}
                  />

                  <input
                    type="number"
                    className="searchinput-measurement"
                    disabled
                    style={{
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #eee",
                      background: "#f7f7f7",
                      textAlign: "center",
                      margin: "5px"
                    }}
                    value={productMeasurements[measurement.name]?.total_value || 0}
                    name={measurement.name + "-total_value"}
                    onChange={handleValueChange}
                    onClick={handleOnClick}
                  />

                  {draftMeasurementsObject &&
                    draftMeasurementsObject[product_name] &&
                    draftMeasurementsObject[product_name]["measurements"][measurement.name] &&
                    Number(draftMeasurementsObject[product_name]["measurements"][measurement.name]["total_value"]) !==
                    Number(productMeasurements[measurement.name]["total_value"]) ? (
                    <span style={{ color: "green", fontSize: "18px", minWidth: "50px", margin: "5px"}}>
                      <CheckCircleOutlineIcon />
                    </span>
                  ) : (
                    <span style={{ color: "green", fontSize: "18px", minWidth: "50px",margin: "5px"}}>
                    </span>
                  )}
                </div>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* ============================================================ */}
      </div>
 


      {product_name == "vest" ? (
        <></>
      )
        : product_name == "pant" ? (
          <></>
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
                  <label htmlFor="standard">
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
                  <label htmlFor="square">
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
  )
}