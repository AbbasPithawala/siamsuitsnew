import React, {useState, useEffect} from 'react';
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import ImageUpload from "./../../images/ImageUpload.png";
import { PicBaseUrl } from "../../imageBaseURL";

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

export default function SutiAdditionalStyles(
  {
    featuresStyle, 
    SuitstylesArray, setSuitstylesArray, 
    product, 
    productIndex,
    normalCount
  }
  ){

const [value, setValue] = useState(0);
const [displayComponent, setDisplayComponent] = useState(false)

useEffect(() => {
  setValue(normalCount)
  setDisplayComponent(true)
}, [normalCount])

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

      setSuitstylesArray({ ...SuitstylesArray });

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
      SuitstylesArray[itemNameID][suitPro]["style"] = object;
      setSuitstylesArray({ ...SuitstylesArray });
    }
  }
  // else if (event.target.dataset.for == "groupStyle") {
  //   if (SuitstylesArray[itemNameID]["groupStyle"]) {
  //     const name = event.target.name.split("_")[0];
  //     let styleInfoObject = {};
  //     styleInfoObject.value = event.target.value;
  //     styleInfoObject.image = event.target.dataset.image;
  //     styleInfoObject.thai_name = event.target.dataset.thainame;
  //     styleInfoObject.additional = event.target.dataset.addtional;
  //     SuitstylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature][event.target.dataset.style] = styleInfoObject
  //     setSuitstylesArray({ ...SuitstylesArray });
  //   } else {
  //     const object = {};
  //     const name = event.target.name.split("_")[0];
  //     let styleInfoObject = {};
  //     styleInfoObject.value = event.target.value;
  //     styleInfoObject.image = event.target.dataset.image;
  //     styleInfoObject.thai_name = event.target.dataset.thaiName;
  //     styleInfoObject.additional = event.target.dataset.addtional;
  //     object[event.target.dataset.style] = styleInfoObject;
  //     let parentObject = {}
  //     parentObject[event.target.dataset.feature] = object
  //     SuitstylesArray[itemNameID][suitPro]['groupStyle'] = parentObject;
  //     setSuitstylesArray({ ...SuitstylesArray });
  //   }
  // }
};

const handleTabChange = (event, newValue) => {
  setValue(Number(newValue) + Number(normalCount));
};


  return(
    displayComponent
    ?
    <>
      <Box sx={{ width: '100%' }} className="form-group frontbutton-info">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs variant="scrollable" value={value-normalCount} onChange={handleTabChange} aria-label="basic tabs example">
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
          if(feature['additional'] == true )
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
                        data-addtional={true}
                        name={feature.name + "_" + productIndex}
                        data-workerprice = {style['worker_price'] ? style['worker_price'] : 0}
                        id={style.name + "_" + productIndex}
                        onChange={(event) =>
                          handleSuitStyleChange(event, productIndex, product)
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