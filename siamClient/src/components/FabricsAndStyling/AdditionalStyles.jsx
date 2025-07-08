import React, {useState, useEffect} from 'react';
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import ImageUpload from "./../../images/ImageUpload.png";
import { PicBaseUrl } from "./../../imageBaseURL";

const ulStyleObject =    { 
  display: "inline-flex",
  width: "100%",
  flexDirection: "row",
  justifycontent: "space-around",
  flexWrap: "wrap",
  marginTop: "20px"
}

const liStyleObject = {
  // border: "solid 2px #e1e1e1",
  borderRadius: "15px",
  padding:"10px 10px",
  width: "15%",
  textAlign: "center",
  marginRight: "10px",
  marginBottom: "10px"
}

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
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

export default function AdditionalStyles({featuresStyle, stylesArray, setStylesArray, product, productIndex, normalStyleCount}){

const [value, setValue] = useState(0);
const [displayComponent, setDisplayComponent] = useState(false)

useEffect(() => {
  setValue(normalStyleCount)
  setDisplayComponent(true)
}, [normalStyleCount])



const handleStyleChange = (event, i) => {

  const itemNameID = product.name + "_" + i;

  if (event.target.dataset.for == "style") {
    if (stylesArray[itemNameID] && stylesArray[itemNameID]["style"]) {

      const name = event.target.name.split("_")[0];
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thainame;
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      stylesArray[itemNameID]["style"][name] = styleInfoObject;
      setStylesArray({ ...stylesArray });

    } else {

      const object = {};
      const name = event.target.name.split("_")[0];
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thaiName;
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      object[name] = styleInfoObject;
      stylesArray[itemNameID]['style'] = object;
      setStylesArray({ ...stylesArray });

    }
  }

};

const handleTabChange = (event, newValue) => {
  setValue(Number(newValue) + Number(normalStyleCount));
};

  return(
    displayComponent
    ?
    <>
      <Box sx={{ width: '100%' }} className="form-group frontbutton-info">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs variant="scrollable" value={value-normalStyleCount} onChange={handleTabChange} aria-label="basic tabs example">
            {featuresStyle.map((feature, index) => {
              if (feature.additional == true) {

                return (
                  <Tab
                    label={feature.name.toUpperCase()}
                    id={`vertical-tab-${index}`}
                    aria-controls={`vertical-tabpanel-${index}`}
                  />
                );
              }
            })}
          </Tabs>
        </Box>
        {featuresStyle.map((feature, index) => {
          if(feature.additional == true )
          {
            return(
            <>
            <TabPanel className={"class1-class1-class1"} value={value} index={index}>
            <ul style={ulStyleObject}>
              {feature['styles'].map((style, key) => {
                  return(
                    <li style={liStyleObject}>
                      <input
                        checked={
                            stylesArray[
                              product.name + "_" + productIndex
                            ].style &&
                            stylesArray[
                              product.name + "_" + productIndex
                            ].style[feature.name] &&
                            stylesArray[
                              product.name + "_" + productIndex
                            ].style[feature.name][
                            "value"
                            ] == style.name
                            ? true
                            : false
                        }
                        type="radio"
                        data-for="style"
                        data-addtional={true}
                        name={feature.name + "_" + productIndex}
                        data-workerprice ={style['worker_price'] ? style['worker_price'] : 0}
                        id={style.name + "_" + productIndex}
                        onChange={(event) =>
                          handleStyleChange(event, productIndex)
                        }
                        value={style.name}
                        style={{ display: "none" }}
                        data-image={style.image}
                        data-thainame={style["thai_name"]}
                      />

                      <label for={style.name + "_" + productIndex}>
                        <img
                          width={100}
                          height={130}
                          src={
                            style.image.length > 0
                            ?
                            PicBaseUrl +
                            style.image
                            :
                            ImageUpload
                          }
                          alt=""
                        />
                        <p>
                          {style.name} <br />
                        </p>
                      </label>
                    </li>
                  )
              })}
            </ul>
            </TabPanel>
            </>
          )}
        })}
      </Box>

    </>
    :
    <></>
  )
}