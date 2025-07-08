import React, {useState, useEffect, useContext} from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Button } from "@mui/material";
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

export default function TuxedoMeasurements({
  newTuxedoMeasurement,
  setNewTuxedoMeasurement,
  tuxedoCustomerMeasurements,
  setTuxedoCustomerMeasurements, 
  draftMeasurementsObject,
  tuxedoSave
  }){

    const handleSuitCustomFitValue = async (name, e) => {
      let arr = [];
  
      for (let y of newTuxedoMeasurement) {
        for (let z of y.custom) {
          if (z.fitting_name === e.target.value) {
            arr.push(z);
            for (let x of Object.keys(tuxedoCustomerMeasurements)) {
              if (x == y.name) {
                tuxedoCustomerMeasurements[x]["fitting_type"] = e.target.value;
              }
            }
          }
        }
      }
      const fitMeasure = arr.filter((x) => {
        return x.fitting_name == e.target.value;
      });
  
      setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
  
      if (e.target.value == "0") {
        // setAdjustmentValueImmutable(false);
  
        for (let y of newTuxedoMeasurement) {
          if (y.name === name) {
            for (let m of Object.keys(y.m)) {
              y.m[m]["adjustment_value"] = 0;
              y.m[m]["total_value"] =
                Number(y.m[m].value) + Number(y.m[m].adjustment_value);
            }
          }
        }
      } else {
        // setAdjustmentValueImmutable(true);
  
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
    const suithandleValueChange = async (e) => {
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
        tuxedoCustomerMeasurements[u.name]["measurements"] = u.m;
      }
      setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
      
      setNewTuxedoMeasurement([...newTuxedoMeasurement]);
    };
    const handleOnClick = async (e) => {
      e.target.value = "";
    };
    const handleSuitTypeChangeType = async (name, e) => {
      if (name === "pant") {
        for (let y of newTuxedoMeasurement) {
          if (y.name === name) {
            for (let x of Object.keys(tuxedoCustomerMeasurements)) {
              if (x == y.name) {
                tuxedoCustomerMeasurements[x]["pant_type"] = e.target.value;
                setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
              }
            }
          }
        }
      } else {
        for (let y of newTuxedoMeasurement) {
          if (y.name === name) {
            for (let x of Object.keys(tuxedoCustomerMeasurements)) {
              if (x == y.name) {
                tuxedoCustomerMeasurements[x]["shoulder_type"] = e.target.value;
                setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
              }
            }
          }
        }
      }
    };  
    const handleSuitNoteChange = async (name, e) => {
      for (let y of newTuxedoMeasurement) {
        if (y.name === name) {
          for (let x of Object.keys(tuxedoCustomerMeasurements)) {
            if (x == y.name) {
              tuxedoCustomerMeasurements[x]["notes"] = e.target.value;
            }
          }
        }
      }
  
      setTuxedoCustomerMeasurements({ ...tuxedoCustomerMeasurements });
    };

console.log("newTuxedoMeasurement: ", newTuxedoMeasurement)
  return(
    <>
    {newTuxedoMeasurement.map((measurement, index) => {
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
                            tuxedoCustomerMeasurements[
                              measurement.name
                            ] &&
                            tuxedoCustomerMeasurements[measurement.name][
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
                            
                
                            {Object.keys(measurement.m).map((data) => (
                              <Grid item xs={6} key={data} style={{padding: "10px 20px"}}>
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
                                  {data.charAt(0).toUpperCase() + data.slice(1)}
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
                                    name={data + "-value"}
                                    value={measurement.m[data]["value"]}
                                    // value={productMeasurements1[data]['value']}
                                    onChange={suithandleValueChange}
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
                                    value={
                                      measurement.m[data][
                                        "adjustment_value"
                                      ]
                                    }
                                    // value={productMeasurements1[data]['adjustment_value']}
                                    // disabled={adjustmentValueImmutable}
                                    name={data + "-adjustment_value"}
                                    onChange={suithandleValueChange}
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
                                    value={
                                      measurement.m[data]["total_value"]
                                    }
                                    // value={productMeasurements1[data]['total_value']}
                                    name={data + "-total_value"}
                                    onChange={suithandleValueChange}
                                    onClick={handleOnClick}
                                  />
                
                                  {draftMeasurementsObject  && draftMeasurementsObject[measurement.name] && draftMeasurementsObject[measurement.name]['measurements'][data] && Number(draftMeasurementsObject[measurement.name]['measurements'][data]['total_value']) !== Number(measurement.m[data]["total_value"]) ? (
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
              {/* <div className="step-2Style-left">
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
                      { Object.keys(measurement.m)
                        .slice(
                          0,
                          Math.ceil(
                            Object.keys(measurement.m).length / 2
                          )
                        )
                        .map((data, i) => {
                          return (
                            <tr key={data}>
                              <td>{data.charAt(0).toUpperCase() + data.slice(1)}</td>
                              <td>
                                <input
                                  type="number"
                                  className="searchinput"
                                  name={data + "-value"}
                                  value={measurement.m[data]["value"]}
                                  // value={productMeasurements1[data]['value']}
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
                                  // value={productMeasurements1[data]['adjustment_value']}
                                  // disabled={adjustmentValueImmutable}
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
                                  // value={productMeasurements1[data]['total_value']}
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
                                  // disabled={adjustmentValueImmutable}
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
              </div> */}
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
                        tuxedoCustomerMeasurements[measurement.name] &&
                        tuxedoCustomerMeasurements[measurement.name][
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

                    <label htmlFor="sloping">
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
                        tuxedoCustomerMeasurements[measurement.name] &&
                        tuxedoCustomerMeasurements[measurement.name][
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
                    <label htmlFor="standard">
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
                        tuxedoCustomerMeasurements[measurement.name] &&
                        tuxedoCustomerMeasurements[measurement.name][
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
                    <label htmlFor="square">
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
            {measurement.name == "pant" ? (
             <></>
            ) : (
              <></>
            )}

            <div className="form-group">
              <label className="note"> Note </label>
              <textarea
                className="searchinput"
                value={
                  tuxedoCustomerMeasurements[measurement.name] &&
                  tuxedoCustomerMeasurements[measurement.name]["notes"]
                    ? tuxedoCustomerMeasurements[measurement.name][
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
      <Button className="custom-btn" onClick={tuxedoSave}>
        Save
      </Button>
    </div>
  </>
  )
}