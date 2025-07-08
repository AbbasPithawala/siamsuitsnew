import React, {useState, useEffect} from 'react';
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import ImageUpload from "./../../images/ImageUpload.png";
import { PicBaseUrl } from "./../../imageBaseURL";
import SuitOptions from "./SuitOptions";

const ulStyleObject =    { 
  display: "inline-flex",
  width: "100%",
  flexDirection: "row",
  justifycontent: "space-around",
  flexWrap: "wrap",
  marginTop: "20px",
  position: 'relative',
  minHeight: '220px'
}

const liStyleObject = {
  borderRadius: "15px",
  padding:"10px 10px",
  width: "15%",
  textAlign: "center",
  marginRight: "10px",
  marginBottom: "10px"
}
const notFilled = {
  color: 'black'
}
const filled = {
  backgroundColor: "#1f71092e",
    fontWeight: "600",
    borderRadius: "10px 10px 0 0",
    color:"#1f7109",
    marginRight: "5px"
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

export default function SuitStyles(
  {
    featuresStyle, 
    SuitstylesArray, setSuitstylesArray, 
    product, 
    productIndex,
    suitFeaturesNameArray,
    suitGroupFeaturesNamesArray,
    isThereSuitGroupFeaturesObject,
    setIsThereSuitGroupFeaturesObject
  }
  ){


const [value, setValue] = useState(0);
const [styleID, setStyleID] = useState("");
const [justFeaturesArray, setJustFeaturesArray] = useState([])
const [localGroupFeaturesObject, setLocalGroupFeaturesObject] = useState({});
const [justGroupFeaturesArray, setJustGroupFeaturesArray] = useState([]);
const [check, setCheck] = useState(false)


useEffect(() => {
  if(SuitstylesArray && SuitstylesArray["suit_" + productIndex] && SuitstylesArray["suit_" + productIndex][product] && SuitstylesArray["suit_" + productIndex][product]['style']){
    setJustFeaturesArray(Object.keys(SuitstylesArray["suit_" + productIndex][product]['style']))
  }

  setCheck(true)
}, [SuitstylesArray])

const handleTabChange = (event, newValue) => {
  setValue(newValue);
};
const handleSuitStyleChange = (event, i, suitPro) => {
  let itemNameID = "suit" + "_" + i;
  if (event.target.dataset.for == "style") {
    if (SuitstylesArray[itemNameID][suitPro]["style"]) {
      const name = event.target.name.split("_")[0];
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thainame;
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      SuitstylesArray[itemNameID][suitPro]["style"][name] = styleInfoObject; 
      if(!justFeaturesArray.includes(name)){
        justFeaturesArray.push(name)
        setJustFeaturesArray([...justFeaturesArray])
      }

      setSuitstylesArray({ ...SuitstylesArray });

    } else {
      const object = {};
      const name = event.target.name.split("_")[0];
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thainame;
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      object[name] = styleInfoObject;
      SuitstylesArray[itemNameID][suitPro]["style"] = object;
      if(!justFeaturesArray.includes(name)){
        justFeaturesArray.push(name)
        setJustFeaturesArray([...justFeaturesArray])
      }
      setSuitstylesArray({ ...SuitstylesArray });
    }
  }
};

  return(
    check
    ?
    <>
      <Box sx={{ width: '100%' }} className="form-group frontbutton-info">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs variant="scrollable" value={value} onChange={handleTabChange} aria-label="basic tabs example">
            {featuresStyle.map((feature, index) => {
              if (feature.additional == false) {
                return (
                  <Tab
                    label={feature.name.toUpperCase()}
                    id={`vertical-tab-${index}`}
                    aria-controls={`vertical-tabpanel-${index}`}
                    // style={feature['styles'][0]['style_options'].length > 0 ? isThereSuitGroupFeaturesObject["suit_" + productIndex] && isThereSuitGroupFeaturesObject["suit_" + productIndex][product] && isThereSuitGroupFeaturesObject["suit_" + productIndex][product][feature.name] ? filled : notFilled : justFeaturesArray.includes(feature.name) ? filled : notFilled }
                    style={justGroupFeaturesArray.includes(feature.name) || justFeaturesArray.includes(feature.name) ? filled : notFilled }
                    />
                );
              }
            })}
          </Tabs>
        </Box>
        {featuresStyle.map((feature, index) => {
          if(feature['additional'] == false )
          {return(
            <>
            <TabPanel className={"class1-class1-class1"} value={value} index={index}>
            <ul style={ulStyleObject}>
              {feature['styles'].map((style, key) => {
                if(!style['style_options'].length > 0){
                  return(
                    <li style={liStyleObject}>
                      <input
                        checked={
                          SuitstylesArray["suit_" + productIndex][
                            product
                          ]
                          &&
                          SuitstylesArray["suit_" + productIndex][
                              product
                            ].style &&
                            SuitstylesArray["suit_" + productIndex][
                              product
                            ].style[feature.name] &&
                            SuitstylesArray["suit_" + productIndex][
                              product
                            ].style[feature.name][
                            "value"
                            ] == style.name
                            ? true
                            : false
                        }
                        type="radio"
                        data-for="style"
                        data-addtional={false}
                        name={feature.name + "_" + productIndex}
                        data-workerprice = {style['worker_price'] ? style['worker_price'] : 0}
                        id={style.name + "_" + productIndex}
                        onChange={(event) =>
                          handleSuitStyleChange(event, productIndex, product)
                        }
                        data-pro={feature.name}
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
                }
                else{
                  return(
                    <SuitOptions
                    min-height="200px"
                    styles={style}
                    productIndex = {productIndex}
                    styleID = {styleID}
                    setStyleID = {setStyleID} 
                    // featureIndex = {key}
                    feature= {feature}
                    SuitstylesArray = {SuitstylesArray}
                    setSuitstylesArray = {setSuitstylesArray}
                    product={product}                    
                    justGroupFeaturesArray = {justGroupFeaturesArray}
                    setJustGroupFeaturesArray = {setJustGroupFeaturesArray} 
                    ></SuitOptions>
                  ) 
                }
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