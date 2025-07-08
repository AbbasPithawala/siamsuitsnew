import React, {useState, useEffect} from 'react';
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import ImageUpload from "./../../images/ImageUpload.png";
import { PicBaseUrl } from "./../../imageBaseURL";
import Options from "./Options";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const ulStyleObject =    { 
  display: "flex",
  width: "100%",
  flexDirection: "row",
  justifycontent: "space-around",
  flexWrap: "wrap",
  marginTop: "20px",
  marginBottom:"20px",
  position: 'relative',
  flexWrap:'no-wrap',
  overflowX:'scroll',

}

const liStyleObject = {
  // border: "solid 2px #e1e1e1",
  borderRadius: "15px",
  padding:"10px 10px",
  width: "auto",
  textAlign: "center",
  marginRight: "0",
  marginBottom: "10px",
  flex: "0 0 15%",
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

export default function Styles(
  {
    featuresStyle, 
    stylesArray, setStylesArray,
    product, 
    productIndex
  }
  ){



const [value, setValue] = useState(0);
const [styleID, setStyleID] = useState("");
const [justFeaturesArray, setJustFeaturesArray] = useState([]);
const [justGroupFeaturesArray, setJustGroupFeaturesArray] = useState([]);
const [check, setCheck] = useState(false)

useEffect(() => {
  if(stylesArray && stylesArray[product.name + "_" + productIndex] && stylesArray[product.name + "_" + productIndex]['style']){
    setJustFeaturesArray(Object.keys(stylesArray[product.name + "_" + productIndex]['style']))
  }
 
  setCheck(true)
}, [stylesArray])

console.log("stylesArray", stylesArray)

const handleStyleChange = (event, i) => {

  const itemNameID = product.name + "_" + i;

  if (event.target.dataset.for == "style") {
    console.log("dataset: ", event.target.dataset)
    if (stylesArray[itemNameID] && stylesArray[itemNameID]["style"]) {
      const name = event.target.name.split("_")[0];
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thainame;
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      stylesArray[itemNameID]["style"][name] = styleInfoObject;
      if(!justFeaturesArray.includes(name)){
        justFeaturesArray.push(name)
        setJustFeaturesArray([...justFeaturesArray])
      }

      setStylesArray({ ...stylesArray });
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
      stylesArray[itemNameID]['style'] = object;
      if(!justFeaturesArray.includes(name)){
        justFeaturesArray.push(name)
        setJustFeaturesArray([...justFeaturesArray])
      }
      setStylesArray({ ...stylesArray });
    }
  }
};

const handleTabChange = (event, newValue) => {
  setValue(newValue);
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
                    // style={feature['styles'][0]['style_options'].length > 0 ? isThereGroupFeaturesObject[product.name + "_" + productIndex] && isThereGroupFeaturesObject[product.name + "_" + productIndex][feature.name] ? filled : notFilled : justFeaturesArray.includes(feature.name) ? filled : notFilled }
                    style={justGroupFeaturesArray.includes(feature.name) || justFeaturesArray.includes(feature.name) ? filled : notFilled }
                    >
                    </Tab>

                );
              }
            })}
          </Tabs>
        </Box>
        {featuresStyle.map((feature, index) => {
          if(feature['additional'] == false )
          {return(
            <>
            <TabPanel className={"class1"} value={value} index={index}>
            <ul className="" style={ulStyleObject}>
              {feature['styles'].map((style, key) => {
                if(!style['style_options'].length > 0){
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
                        data-addtional={false}
                        name={feature.name + "_" + productIndex}
                        data-workerprice={style['worker_price'] ? style['worker_price'] : 0}
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
                }
                else{
                  return(
                    <Options
                    min-height="300px"
                    styles={style}
                    productIndex = {productIndex}
                    styleID = {styleID}
                    setStyleID = {setStyleID} 
                    feature= {feature}
                    stylesArray = {stylesArray}
                    setStylesArray = {setStylesArray}
                    product={product}
                    justGroupFeaturesArray = {justGroupFeaturesArray}
                    setJustGroupFeaturesArray = {setJustGroupFeaturesArray}  
                    style={{minHeight: '500px'}}
                    ></Options>
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
    <>
    </>
  )
}