import React from "react";
import "./MissingFabric.css";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion from "@mui/material/Accordion";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import { useContext, useEffect, useState } from "react";
import { Context } from "./../../context/Context";
import { axiosInstance } from "./../../config";
import { PicBaseUrl } from "./../../imageBaseURL";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { style } from "@mui/system/Stack/createStack";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import ImageUpload from "./../../images/ImageUpload.png";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Styles from './Styles';
import AdditionalStyles from './AdditionalStyles';
import SuitStyles from "./SuitStyles";
import SuitAdditionalStyles from './SuitAdditionalStyles';
import TuxedoStyles from "./TuxedoStyles"
import TuxedoAdditionalStyles from "./TuxedoAdditionalStyles"


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

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


function TabPanel2(props) {
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

TabPanel2.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function TabPanel3(props) {
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

TabPanel3.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={
      <ArrowForwardIosSharpIcon sx={{ fontSize: "0.8rem", color: "#242424" }} />
    }
    {...props}
  />
))(({ theme }) => ({}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(0.5),
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

const colorData = [
  {
    id: "1",
    color: "#CD3534",
    value: "1102",
  },
  {
    id: "2",
    color: "#B94E9C",
    value: "1157J",
  },
  {
    id: "3",
    color: "#CBCD2C",
    value: "1318",
  },
  {
    id: "4",
    color: "#F7DF0D",
    value: "1309",
  },
  {
    id: "5",
    color: "#0E6835",
    value: "1466",
  },
  {
    id: "6",
    color: "#AF9E34",
    value: "1325",
  },
  {
    id: "7",
    color: "#451E5F",
    value: "1613",
  },
  {
    id: "8",
    color: "#633513",
    value: "1721",
  },
  {
    id: "9",
    color: "#666867",
    value: "1875",
  },
  {
    id: "10",
    color: "#262827",
    value: "1901",
  },
  {
    id: "11",
    color: "#2C3C81",
    value: "1902",
  },
  {
    id: "12",
    color: "#981A1E",
    value: "6007",
  },
  {
    id: "13",
    color: "#620C0D",
    value: "6008",
  },
  {
    id: "14",
    color: "#F03C23",
    value: "6012",
  },
  {
    id: "15",
    color: "#F6E1EA",
    value: "6023",
  },
  {
    id: "16",
    color: "#E5BAD6",
    value: "6024",
  },
  {
    id: "17",
    color: "#D9A7CC",
    value: "6025",
  },
  {
    id: "18",
    color: "#BE70AE",
    value: "6026",
  },
  {
    id: "19",
    color: "#F6E1EA",
    value: "6029",
  },
  {
    id: "20",
    color: "#F89A38",
    value: "6033",
  },
  {
    id: "21",
    color: "#FBCB9A",
    value: "6036",
  },
  {
    id: "22",
    color: "#2F1111",
    value: "6073",
  },
  {
    id: "23",
    color: "#DCCA22",
    value: "6085",
  },
  {
    id: "24",
    color: "#FCFBCF",
    value: "6087",
  },
  {
    id: "25",
    color: "#666867",
    value: "6092",
  },
  {
    id: "26",
    color: "#989898",
    value: "6095",
  },
  {
    id: "27",
    color: "#451E5F",
    value: "6104",
  },
  {
    id: "28",
    color: "#E3CBE3",
    value: "6117",
  },
  {
    id: "29",
    color: "#0C1131",
    value: "6122",
  },
  {
    id: "30",
    color: "#34469A",
    value: "6128",
  },
  {
    id: "31",
    color: "#1683C6",
    value: "6134",
  },
  {
    id: "32",
    color: "#7CC7EF",
    value: "6135",
  },
  {
    id: "33",
    color: "#98D5F4",
    value: "6136",
  },
  {
    id: "34",
    color: "#A2DEF8",
    value: "6140",
  },
  {
    id: "35",
    color: "#A9DDE8",
    value: "6148",
  },
  {
    id: "36",
    color: "#183219",
    value: "6156",
  },
  {
    id: "37",
    color: "#183219",
    value: "6157",
  },
  {
    id: "38",
    color: "#4BBE95",
    value: "6172",
  },
  {
    id: "39",
    color: "#F7EB35",
    value: "7005",
  },
  {
    id: "40",
    color: "#9960A7",
    value: "7013",
  },
  {
    id: "41",
    color: "#CDA4CE",
    value: "7020",
  },
  {
    id: "42",
    color: "#333333",
    value: "9093",
  },
];

const fontStyle = [
  {
    id: 1,
    image: "/ImagesFabric/Monogram-Font-Style/011.jpg",
    styleName: "Style-01",
  },
  {
    id: 2,
    image: "/ImagesFabric/Monogram-Font-Style/021.jpg",
    styleName: "Style-02",
  },
  {
    id: 3,
    image: "/ImagesFabric/Monogram-Font-Style/031.jpg",
    styleName: "Style-03",
  },
  {
    id: 4,
    image: "/ImagesFabric/Monogram-Font-Style/041.jpg",
    styleName: "Style-04",
  },
  {
    id: 5,
    image: "/ImagesFabric/Monogram-Font-Style/051.jpg",
    styleName: "Style-05",
  },
  {
    id: 6,
    image: "/ImagesFabric/Monogram-Font-Style/061.jpg",
    styleName: "Style-06",
  },
  {
    id: 7,
    image: "/ImagesFabric/Monogram-Font-Style/071.jpg",
    styleName: "Style-07",
  },
  {
    id: 8,
    image: "/ImagesFabric/Monogram-Font-Style/081.jpg",
    styleName: "Style-08",
  },
  {
    id: 9,
    image: "/ImagesFabric/Monogram-Font-Style/091.jpg",
    styleName: "Style-09",
  },
];

export default function MissingFabric(props) {
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = React.useState("");
  const [expanded1, setExpanded1] = React.useState("");
  const { user } = useContext(Context);
  const [piping, setPiping] = useState([]);
  const [imageData, setImageData] = useState(null);
  const [imageDataSuit, setImageDataSuit] = useState(null);
  const [imageDataTuxedo, setImageDataTuxedo] = useState(null);
  const [imageDataJacket, setImageDataJacket] = useState(null);
  const [imageDataPant, setImageDataPant] = useState(null);
  const [productID, setProductID] = useState("");
  const [product, setProduct] = useState([]);
  const [features, setFeatures] = useState([]);
  const [styleObject, setStyleObject] = useState({});
  const [orderQuantityArray, setOrderQuantityArray] = useState([]);
  const [stylesArray, setStylesArray] = useState({});
  // suit state
  const [SuitstyleObject, setSuitstyleObject] = useState({});
  const [TuxedostyleObject, setTuxedostyleObject] = useState({});
  const [SuitPant, setSuitPant] = useState([]);
  const [SuitJacket, setSuitJacket] = useState([]);
  const [TuxedoPant, setTuxedoPant] = useState([]);
  const [TuxedoJacket, setTuxedoJacket] = useState([]);
  const [suitOrderQuantityArray, setSuitOrderQuantityArray] = useState([]);
  const [tuxeodOrderQuantityArray, setTuxeodOrderQuantityArray] = useState([]);
  const [SuitstylesArray, setSuitstylesArray] = useState({});
  const [TuxedostylesArray, setTuxedostylesArray] = useState({});

  const [normalStyleCount, setNormalStyleCount] = useState(0);
  const [normalJacketStyleCount, setNormalJacketStyleCount] = useState(0);
  const [normalTuxedoJacketStyleCount, setNormalTuxedoJacketStyleCount] = useState(0);
  const [normalPantStyleCount, setNormalPantStyleCount] = useState(0);
  const [normalTuxedoPantStyleCount, setNormalTuxedoPantStyleCount] = useState(0);
  const [featuresNameArray, setFeaturesNameArray] = useState([]);
  const [groupFeaturesNamesArray2, setGroupFeaturesNamesArray2] = useState({});
  const [suitFeaturesNameArray, setSuitFeaturesNameArray] = useState({})
  const [tuxedoFeaturesNameArray, setTuxedoFeaturesNameArray] = useState({})
  const [suitGroupFeaturesNamesArray, setSuitGroupFeaturesNamesArray] = useState({});
  const [tuxedoGroupFeaturesNamesArray, setTuxedoGroupFeaturesNamesArray] = useState({});
  const [showMonogram, setShowMonogram] = useState({})
  const [showAdditionalStyles, setShowAdditionalStyles] = useState({})
  const [showSuitAdditionalStyles, setShowSuitAdditionalStyles] = useState({})
  const [showTuxedoAdditionalStyles, setShowTuxedoAdditionalStyles] = useState({})

  // console.log("product name: ", product)
  useEffect(() => {
    const fetchProduct = async () => {
      if (props.data == "suit") {
        let arr = ["jacket", "pant"];
        for (let x of props.orders) {
          if (x.item_name == "suit") {
            setSuitstyleObject(x);
            let array = [];
            let arrayOneMore = {};
            for (let i = 0; i < x.quantity; i++) {
              if (x.styles && x.styles["suit" + "_" + i]) {
                if (x.quantity > Object.keys(x.styles).length) {
                  let extraQuantity =
                    x.quantity > Object.keys(x.styles["suit" + "_" + i]).length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = "suit" + "_" + (i + m);
                    arrayOneMore[itemId] = {
                      jacket: {}
                    };
                  }
                }
                let itemId = "suit" + "_" + i;
                arrayOneMore[itemId] = x.styles["suit" + "_" + i];
              } else if (x.styles && x.styles[0] !== undefined && x.styles[0]["suit" + "_" + i]) {
                if (x.quantity > Object.keys(x.styles[0]).length) {
                  let extraQuantity = x.quantity > Object.keys(x.styles[0]["suit" + "_" + i]).length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = "suit" + "_" + (i + m)
                    arrayOneMore[itemId] = { "jacket": {}, "pant": {} }
                  }
                }
                let itemId = "suit" + "_" + i
                arrayOneMore[itemId] = x.styles[0]["suit" + "_" + i]
              } else {
                let itemId = "suit" + "_" + i;
                arrayOneMore[itemId] = {
                  jacket: {},
                  pant: {}
                };
              }

              array.push(i);
            }
            const array1 = []


            setSuitstylesArray(arrayOneMore);
            setSuitOrderQuantityArray(array);

          }
        }
      }
      else if (props.data == "tuxedo") {
        let arr = ["tuxedojacket", "pant"];
        for (let x of props.orders) {
          if (x.item_name == "tuxedo") {
            setTuxedostyleObject(x);
            let array = [];
            let arrayOneMore = {};
            for (let i = 0; i < x.quantity; i++) {
              if (x.styles && x.styles["tuxedo" + "_" + i]) {
                if (x.quantity > Object.keys(x.styles).length) {
                  let extraQuantity =
                    x.quantity > Object.keys(x.styles["tuxedo" + "_" + i]).length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = "tuxedo" + "_" + (i + m);
                    arrayOneMore[itemId] = {
                      jacket: {}
                    };
                  }
                }
                let itemId = "tuxedo" + "_" + i;
                arrayOneMore[itemId] = x.styles["tuxedo" + "_" + i];
              } else if (x.styles && x.styles[0] !== undefined && x.styles[0]["tuxedo" + "_" + i]) {
                if (x.quantity > Object.keys(x.styles[0]).length) {
                  let extraQuantity = x.quantity > Object.keys(x.styles[0]["tuxedo" + "_" + i]).length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = "tuxedo" + "_" + (i + m)
                    arrayOneMore[itemId] = { "tuxedojacket": {}, "pant": {} }
                  }
                }
                let itemId = "tuxedo" + "_" + i
                arrayOneMore[itemId] = x.styles[0]["tuxedo" + "_" + i]
              } else {
                let itemId = "tuxedo" + "_" + i;
                arrayOneMore[itemId] = {
                  tuxedojacket: {},
                  pant: {}
                };
              }

              array.push(i);
            }
            const array1 = []


            setTuxedostylesArray(arrayOneMore);
            setTuxeodOrderQuantityArray(array);

          }
        }
      }
      else {
        const res = await axiosInstance.post(
          "/product/fetchByName/" + props.data,
          {
            token: user.data.token,
          }
        );
        setProduct(res.data.data[0]);

        for (let x of props.orders) {
          if (x.item_name == res.data.data[0]["name"]) {
            setStyleObject(x);
            let array = [];
            let arrayOneMore = {};
            for (let i = 0; i < x.quantity; i++) {
              if (x.styles && x.styles[res.data.data[0]["name"] + "_" + i]) {
                if (x.quantity > Object.keys(x.styles).length) {
                  let extraQuantity =
                    x.quantity >
                    Object.keys(x.styles[res.data.data[0]["name"] + "_" + i])
                      .length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = res.data.data[0]["name"] + "_" + (i + m);
                    arrayOneMore[itemId] = {};
                  }
                }
                let itemId = res.data.data[0]["name"] + "_" + i;
                arrayOneMore[itemId] =
                  x.styles[res.data.data[0]["name"] + "_" + i];
              } else if (x.styles && x.styles[0] !== undefined && x.styles[0][res.data.data[0]['name'] + "_" + i]) {
                if (x.quantity > Object.keys(x.styles[0]).length) {
                  let extraQuantity = x.quantity > Object.keys(x.styles[0][res.data.data[0]['name'] + "_" + i]).length;
                  for (let m = 1; m <= extraQuantity; m++) {
                    let itemId = res.data.data[0]['name'] + "_" + (i + m)
                    arrayOneMore[itemId] = {}
                  }
                }
                let itemId = res.data.data[0]['name'] + "_" + i
                arrayOneMore[itemId] = x.styles[0][res.data.data[0]['name'] + "_" + i]
              } else {
                let itemId = res.data.data[0]["name"] + "_" + i;
                arrayOneMore[itemId] = {};
              }

              array.push(i);
            }
            const array1 = []
            for (let x of res.data.data[0]['features']) {
              if (x['additional'] == false) {
                array1.push(x.name)
              }
            }
            setFeaturesNameArray(array1)
            var arrayJustOneMore = { ...arrayJustOneMore }
            setStylesArray(arrayOneMore)
            // setStylesArray(arrayOneMore);
            setOrderQuantityArray(array);
          }
        }


        setProductID(res.data.data[0]["_id"]);

        const featuresArray = [];
        let normalStyleQuantity = 0;
        let groupFeaturesNameArray2t = [];
        for (let x of res.data.data[0]["features"]) {
          const res2 = await axiosInstance.post("/feature/fetch/" + x._id, {
            token: user.data.token,
          });
          for (let styles of res2.data.data[0]['styles']) {
            if (styles['style_options'].length > 0) {
              if (!groupFeaturesNameArray2t.includes(x['name'])) {
                groupFeaturesNameArray2t.push(x['name'])
              }
            }
          }
          featuresArray.push(res2.data.data[0]);
          if (res2.data.data[0]['additional'] == false) {
            normalStyleQuantity = normalStyleQuantity + 1
          }
        }
        setGroupFeaturesNamesArray2(groupFeaturesNameArray2t)
        setNormalStyleCount(normalStyleQuantity)
        setFeatures(featuresArray);
      }
    };
    fetchProduct();

    const fetch = async () => {
      const res = await axiosInstance.post("/piping/fetchAll", {
        token: user.data.token,
      });
      setPiping(res.data.data);
    };

    fetch();
  }, [props.data]);

  useEffect(() => {
    const fetchFeature = async () => {
      if (props.data == "suit") {
        const res = await axiosInstance.post(
          "/product/fetchByJacketName/" + "jacket",
          {
            token: user.data.token,
          }
        );

        const res1 = await axiosInstance.post(
          "/product/fetchByJacketName/" + "pant",
          {
            token: user.data.token,
          }
        );

        setSuitJacket(res.data.data[0]);
        setSuitPant(res1.data.data[0]);

        let normalStyleJQuantity = 0;
        for (let x of res.data.data[0]["features"]) {

          if (x['additional'] == false) {
            normalStyleJQuantity = normalStyleJQuantity + 1
          }
        }
        const jarray = []
        for (let x of res.data.data[0]['features']) {

          if (x['additional'] == false) {
            jarray.push(x['name'])
          }
          suitFeaturesNameArray['jacket'] = jarray
          setSuitFeaturesNameArray({ ...suitFeaturesNameArray })
          for (let styles of x['styles']) {
            if (styles['style_options'].length > 0) {
              if (suitGroupFeaturesNamesArray['jacket']) {
                if (!suitGroupFeaturesNamesArray['jacket'].includes(x['name'])) {
                  suitGroupFeaturesNamesArray['jacket'].push(x['name'])
                  setSuitGroupFeaturesNamesArray({ ...suitGroupFeaturesNamesArray })
                }
              } else {
                suitGroupFeaturesNamesArray['jacket'] = [x['name']]
              }
            }
          }
          // if(optionsArray.length > 0 ){
          //   const obj = {}
          //   obj[x['name']] = optionsArray
          //   suitGroupFeaturesNamesArray['jacket'] = obj 

          //   for(let ord of props.orders){
          //     for(let i=0; i < ord['quantity']; i++){
          //       if(props.data == ord['item_name']){
          //         if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]){
          //           if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket']){
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket'][x['name']] = false
          //           }else{
          //             const obj = {}
          //             obj[x['name']] = false
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket'] = obj
          //           }
          //         }else{
          //           const justAnObject = {}
          //           const oneMoreObj = {}
          //           justAnObject[x['name']] = false
          //           oneMoreObj['jacket'] = justAnObject
          //           isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i] = oneMoreObj
          //         }
          //         setIsThereSuitGroupFeaturesObject({...isThereSuitGroupFeaturesObject})
          //       }

          //     }
          //   }
          //   setSuitGroupFeaturesNamesArray({...suitGroupFeaturesNamesArray})
          // }
        }
        const parray = []
        for (let x of res1.data.data[0]['features']) {

          if (x['additional'] == false) {
            parray.push(x['name'])
          }
          suitFeaturesNameArray['pant'] = parray
          setSuitFeaturesNameArray({ ...suitFeaturesNameArray });
          for (let styles of x['styles']) {
            if (styles['style_options'].length > 0) {
              if (suitGroupFeaturesNamesArray['pant']) {
                if (!suitGroupFeaturesNamesArray['pant'].includes(x['name'])) {
                  suitGroupFeaturesNamesArray['pant'].push(x['name'])
                  setSuitGroupFeaturesNamesArray({ ...suitGroupFeaturesNamesArray })
                }
              } else {
                suitGroupFeaturesNamesArray['pant'] = [x['name']]
              }
            }
          }
          // if(optionsArray1.length > 0 ){
          //   const obj = {}
          //   obj[x['name']] = optionsArray1
          //   suitGroupFeaturesNamesArray['pant'] = obj

          //   for(let ord of props.orders){
          //     for(let i=0; i < ord['quantity']; i++){
          //       if(props.data == ord['item_name']){
          //         if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]){
          //           if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant']){
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant'][x['name']] = false
          //           }else{
          //             const obj = {}
          //             obj[x['name']] = false
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant'] = obj
          //           }
          //         }else{
          //           const justAnObject = {}
          //           const oneMoreObj = {}
          //           justAnObject[x['name']] = false
          //           oneMoreObj['pant'] = justAnObject
          //           isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i] = oneMoreObj
          //         }
          //         setIsThereSuitGroupFeaturesObject({...isThereSuitGroupFeaturesObject})
          //       }

          //     }
          //   }
          //   setSuitGroupFeaturesNamesArray({...suitGroupFeaturesNamesArray})
          // }
        }

        let normalStylePQuantity = 0;
        for (let x of res1.data.data[0]["features"]) {

          if (x['additional'] == false) {
            normalStylePQuantity = normalStylePQuantity + 1
          }
        }
        setNormalPantStyleCount(normalStylePQuantity)
        setNormalJacketStyleCount(normalStyleJQuantity)

      } else if (props.data == "tuxedo") {
        const res = await axiosInstance.post(
          "/product/fetchByJacketName/" + "tuxedojacket",
          {
            token: user.data.token,
          }
        );

        const res1 = await axiosInstance.post(
          "/product/fetchByJacketName/" + "pant",
          {
            token: user.data.token,
          }
        );

        setTuxedoJacket(res.data.data[0]);
        setTuxedoPant(res1.data.data[0]);

        let normalStyleJQuantity = 0;
        for (let x of res.data.data[0]["features"]) {

          if (x['additional'] == false) {
            normalStyleJQuantity = normalStyleJQuantity + 1
          }
        }
        const jarray = []
        for (let x of res.data.data[0]['features']) {

          if (x['additional'] == false) {
            jarray.push(x['name'])
          }
          tuxedoFeaturesNameArray['tuxedojacket'] = jarray
          setTuxedoFeaturesNameArray({ ...tuxedoFeaturesNameArray })
          for (let styles of x['styles']) {
            if (styles['style_options'].length > 0) {
              if (tuxedoGroupFeaturesNamesArray['tuxedojacket']) {
                if (!tuxedoGroupFeaturesNamesArray['tuxedojacket'].includes(x['name'])) {
                  tuxedoGroupFeaturesNamesArray['tuxedojacket'].push(x['name'])
                  setTuxedoGroupFeaturesNamesArray({ ...tuxedoGroupFeaturesNamesArray })
                }
              } else {
                tuxedoGroupFeaturesNamesArray['tuxedojacket'] = [x['name']]
              }
            }
          }
          // if(optionsArray.length > 0 ){
          //   const obj = {}
          //   obj[x['name']] = optionsArray
          //   suitGroupFeaturesNamesArray['jacket'] = obj 

          //   for(let ord of props.orders){
          //     for(let i=0; i < ord['quantity']; i++){
          //       if(props.data == ord['item_name']){
          //         if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]){
          //           if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket']){
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket'][x['name']] = false
          //           }else{
          //             const obj = {}
          //             obj[x['name']] = false
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['jacket'] = obj
          //           }
          //         }else{
          //           const justAnObject = {}
          //           const oneMoreObj = {}
          //           justAnObject[x['name']] = false
          //           oneMoreObj['jacket'] = justAnObject
          //           isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i] = oneMoreObj
          //         }
          //         setIsThereSuitGroupFeaturesObject({...isThereSuitGroupFeaturesObject})
          //       }

          //     }
          //   }
          //   setSuitGroupFeaturesNamesArray({...suitGroupFeaturesNamesArray})
          // }
        }
        const parray = []
        for (let x of res1.data.data[0]['features']) {

          if (x['additional'] == false) {
            parray.push(x['name'])
          }
          tuxedoFeaturesNameArray['pant'] = parray
          setTuxedoFeaturesNameArray({ ...tuxedoFeaturesNameArray });
          for (let styles of x['styles']) {
            if (styles['style_options'].length > 0) {
              if (tuxedoGroupFeaturesNamesArray['pant']) {
                if (!tuxedoGroupFeaturesNamesArray['pant'].includes(x['name'])) {
                  tuxedoGroupFeaturesNamesArray['pant'].push(x['name'])
                  setTuxedoGroupFeaturesNamesArray({ ...tuxedoGroupFeaturesNamesArray })
                }
              } else {
                tuxedoGroupFeaturesNamesArray['pant'] = [x['name']]
              }
            }
          }
          // if(optionsArray1.length > 0 ){
          //   const obj = {}
          //   obj[x['name']] = optionsArray1
          //   suitGroupFeaturesNamesArray['pant'] = obj

          //   for(let ord of props.orders){
          //     for(let i=0; i < ord['quantity']; i++){
          //       if(props.data == ord['item_name']){
          //         if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]){
          //           if(isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant']){
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant'][x['name']] = false
          //           }else{
          //             const obj = {}
          //             obj[x['name']] = false
          //             isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i]['pant'] = obj
          //           }
          //         }else{
          //           const justAnObject = {}
          //           const oneMoreObj = {}
          //           justAnObject[x['name']] = false
          //           oneMoreObj['pant'] = justAnObject
          //           isThereSuitGroupFeaturesObject[ord['item_name'] + "_" + i] = oneMoreObj
          //         }
          //         setIsThereSuitGroupFeaturesObject({...isThereSuitGroupFeaturesObject})
          //       }

          //     }
          //   }
          //   setSuitGroupFeaturesNamesArray({...suitGroupFeaturesNamesArray})
          // }
        }

        let normalStylePQuantity = 0;
        for (let x of res1.data.data[0]["features"]) {

          if (x['additional'] == false) {
            normalStylePQuantity = normalStylePQuantity + 1
          }
        }
        setNormalPantStyleCount(normalStylePQuantity)
        setNormalTuxedoJacketStyleCount(normalStyleJQuantity)

      } else {
      }
    };
    fetchFeature();
  }, []);
  console.log("suits group: ", suitGroupFeaturesNamesArray)
  console.log("tux group: ", tuxedoGroupFeaturesNamesArray)
  const handleChange = (panel) => (event, newExpanded) => {
    setExpanded(newExpanded ? panel : false);
  };


  const handleSuitChange = (panel) => (event, newExpanded) => {
    setExpanded1(newExpanded ? panel : false);
  };

  const handleChangeAccordion = (panel) => (event, newExpanded) => {
    setExpanded1(newExpanded ? panel : false);
  };



  const handleChangeInput = (event, i) => {
    const itemNameID = product.name + "_" + i;

    if (event.target.dataset.for == "monogram") {
      if (stylesArray[itemNameID]["monogram"]) {
        stylesArray[itemNameID]["monogram"][event.target.name] =
          event.target.value;
        setStylesArray({ ...stylesArray });
      } else {
        const object = {};
        object[event.target.name] = event.target.value;
        stylesArray[itemNameID]["monogram"] = object;
        setStylesArray({ ...stylesArray });
      }
    } else {
      stylesArray[itemNameID][event.target.name] = event.target.value;
      setStylesArray({ ...stylesArray });
    }
  };

  const handleSubmit = () => {
    let orderArray = props.orders;
    let i = 0;
    var canSubmitStyles = true
    for (let x of orderArray) {
      if (props.data == "suit" && x.item_name == "suit") {
        let obj = {};
        obj["styles"] = SuitstylesArray;
        x.quantity = Object.keys(SuitstylesArray).length;
        let newObject = { ...SuitstyleObject, ...obj };
        orderArray[i] = newObject;
        const newObjectOfFeatures = {}
        for (let pro of Object.keys(suitFeaturesNameArray)) {

          newObjectOfFeatures[pro] = suitFeaturesNameArray[pro].filter((x) => {
            if (suitGroupFeaturesNamesArray[pro]) {
              return !Object.keys(suitGroupFeaturesNamesArray[pro]).includes(x)
            } else {
              return x
            }
          })
        }
        const ar3 = suitFeaturesNameArray['jacket'].filter(x => !suitGroupFeaturesNamesArray['jacket'].includes(x))

        // var canSubmitSuitsStyles = true
        const objFNA = {}
        objFNA['pant'] = suitFeaturesNameArray['pant']
        objFNA['jacket'] = ar3

        for (let suits of Object.keys(SuitstylesArray)) {
          for (let x of objFNA['jacket']) {
            if (!SuitstylesArray[suits]['jacket']['style'] || !Object.keys(SuitstylesArray[suits]['jacket']['style']).includes(x)) {
              canSubmitStyles = false
            }
          }
          for (let x of objFNA['pant']) {
            if (!SuitstylesArray[suits]['pant']['style'] || !Object.keys(SuitstylesArray[suits]['pant']['style']).includes(x)) {
              canSubmitStyles = false
            }
          }

          for (let x of suitGroupFeaturesNamesArray['jacket']) {
            if (!SuitstylesArray[suits]['jacket']['groupStyle'] || !Object.keys(SuitstylesArray[suits]['jacket']['groupStyle']).includes(x)) {
              canSubmitStyles = false
            }
          }
        }

        i = i + 1;
      } else if (props.data == "tuxedo" && x.item_name == "tuxedo") {
        let obj = {};
        obj["styles"] = TuxedostylesArray;
        x.quantity = Object.keys(TuxedostylesArray).length;
        let newObject = { ...TuxedostyleObject, ...obj };
        orderArray[i] = newObject;
        const newObjectOfFeatures = {}
        for (let pro of Object.keys(tuxedoFeaturesNameArray)) {

          newObjectOfFeatures[pro] = tuxedoFeaturesNameArray[pro].filter((x) => {
            if (tuxedoGroupFeaturesNamesArray[pro]) {
              return !Object.keys(tuxedoGroupFeaturesNamesArray[pro]).includes(x)
            } else {
              return x
            }
          })
        }
        const ar3 = tuxedoFeaturesNameArray['tuxedojacket'].filter(x => !tuxedoGroupFeaturesNamesArray['tuxedojacket']?.includes(x))

        // var canSubmitSuitsStyles = true
        const objFNA = {}
        objFNA['pant'] = tuxedoFeaturesNameArray['pant']
        objFNA['tuxedojacket'] = ar3

        for (let tuxedo of Object.keys(TuxedostylesArray)) {
          for (let x of objFNA['tuxedojacket']) {
            if (!TuxedostylesArray[tuxedo]['tuxedojacket']['style'] || !Object.keys(TuxedostylesArray[tuxedo]['tuxedojacket']['style']).includes(x)) {
              canSubmitStyles = false
            }
          }
          for (let x of objFNA['pant']) {
            if (!TuxedostylesArray[tuxedo]['pant']['style'] || !Object.keys(TuxedostylesArray[tuxedo]['pant']['style']).includes(x)) {
              canSubmitStyles = false
            }
          }

          if(tuxedoGroupFeaturesNamesArray['tuxedojacket']){
            for (let x of tuxedoGroupFeaturesNamesArray['tuxedojacket']) {
              if (!TuxedostylesArray[tuxedo]['tuxedojacket']['groupStyle'] || !Object.keys(TuxedostylesArray[tuxedo]['tuxedojacket']['groupStyle']).includes(x)) {
                canSubmitStyles = false
              }
            }
          }
        }

        i = i + 1;
      }else {
        if (x.item_name == product["name"]) {

          let stylesObjects = {};
          stylesObjects["styles"] = stylesArray;
          x.quantity = Object.keys(stylesArray).length;
          let newObject = { ...styleObject, ...stylesObjects };
          orderArray[i] = newObject;
        }
        i = i + 1;

        // var canSubmitStyles = true

        const ar3 = featuresNameArray.filter(x => !groupFeaturesNamesArray2.includes(x))

        for (let items of Object.keys(stylesArray)) {
          for (let featureName of ar3) {
            if (!stylesArray[items]['style'] || !Object.keys(stylesArray[items]['style']).includes(featureName)) {
              canSubmitStyles = false
            }
          }

          if (groupFeaturesNamesArray2) {
            for (let gr of groupFeaturesNamesArray2) {
              if (!stylesArray[items]['groupStyle'] || !Object.keys(stylesArray[items]['groupStyle']).includes(gr)) {
                canSubmitStyles = false
              }
            }
          }

        }

      }
    }
    if (canSubmitStyles) {
      props.setOrders([...orderArray]);
      props.saveData();
    } else {
      alert("Please Selet all the normal styles")
    }

  };



  const handlePipingInput = (e, i) => {
    const itemNameID = product.name + "_" + i;
    const name = e.target.name.split("_")[0];
    stylesArray[itemNameID][name] = e.target.value;
    setStylesArray({ ...stylesArray });
  };

  const handleMonogramFontstyleChange = (e, i) => {
    const itemNameID = product.name + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (stylesArray[itemNameID]["monogram"]) {
        stylesArray[itemNameID]["monogram"][name] = e.target.value;
        setStylesArray({ ...stylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        stylesArray[itemNameID]["monogram"] = object;
        setStylesArray({ ...stylesArray });
      }
    }
  };

  const handleMonogramSideChange = (e, i) => {
    const itemNameID = product.name + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (stylesArray[itemNameID]["monogram"]) {
        stylesArray[itemNameID]["monogram"][name] = e.target.value;
        setStylesArray({ ...stylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        stylesArray[itemNameID]["monogram"] = object;
        setStylesArray({ ...stylesArray });
      }
    }
  };

  const handleMonogramColorChange = (e, i) => {
    const itemNameID = product.name + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (stylesArray[itemNameID]["monogram"]) {
        stylesArray[itemNameID]["monogram"][name] = e.target.value;
        setStylesArray({ ...stylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        stylesArray[itemNameID]["monogram"] = object;
        setStylesArray({ ...stylesArray });
      }
    }
  };

  const handleCopyStyleData = (e, i) => {
    if (e.target.checked) {
      const itemIDcurrent = product["name"] + "_" + i;
      const itemIDprevious = product["name"] + "_" + (i - 1);
      let newObject = { ...stylesArray[itemIDprevious] };
      let newMonogramObject = { ...stylesArray[itemIDprevious]["monogram"] };
      let newStylesObject = { ...stylesArray[itemIDprevious]["style"] };

      stylesArray[itemIDcurrent] = newObject;
      stylesArray[itemIDcurrent]["monogram"] = newMonogramObject;
      stylesArray[itemIDcurrent]["style"] = newStylesObject;

      setStylesArray({ ...stylesArray });
    } else {
      const itemIDcurrent = product["name"] + "_" + i;
      stylesArray[itemIDcurrent] = {};
      setStylesArray({ ...stylesArray });
    }
  };

  const handleDeleteThisItem = (e, i) => {
    let oldStylesObject = stylesArray;
    delete oldStylesObject[product["name"] + "_" + i];

    let newStylesObject = {};
    let m = 0;
    for (let x of Object.keys(oldStylesObject)) {
      newStylesObject[product["name"] + "_" + m] = oldStylesObject[x];

      m = m + 1;
    }
    orderQuantityArray.pop();
    setStylesArray({ ...newStylesObject });
    props.setJacketCount(props.jacketCount - 1);
    props.setTotalQuantity(props.jacketCount - 1);
    props.setOrders([...props.orders]);
  };

  const handleShirtMonogram = (e, index) => {
    if (e.target.checked) {
      showMonogram[index] = true
      setShowMonogram({ ...showMonogram })
    } else {
      showMonogram[index] = false
      setShowMonogram({ ...showMonogram })
    }
  }

  const handleShowAdditionalStyles = (e, index) => {
    if (e.target.checked) {
      showAdditionalStyles[index] = true
      setShowAdditionalStyles({ ...showAdditionalStyles })
    } else {
      showAdditionalStyles[index] = false
      setShowAdditionalStyles({ ...showAdditionalStyles })
    }
  }

  const handleShowSuitAdditionalStyles = (e, index, pr) => {
    if (e.target.checked) {
      showSuitAdditionalStyles[pr + "_" + index] = true
      setShowSuitAdditionalStyles({ ...showSuitAdditionalStyles })
    } else {
      showSuitAdditionalStyles[pr + "_" + index] = false
      setShowSuitAdditionalStyles({ ...showSuitAdditionalStyles })
    }
  }


  const handleShowTuxedoAdditionalStyles = (e, index, pr) => {
    if (e.target.checked) {
      showTuxedoAdditionalStyles[pr + "_" + index] = true
      setShowTuxedoAdditionalStyles({ ...showTuxedoAdditionalStyles })
    } else {
      showTuxedoAdditionalStyles[pr + "_" + index] = false
      setShowTuxedoAdditionalStyles({ ...showTuxedoAdditionalStyles })
    }
  }

  //------------------- suit style handle ----------------- //

  const handleSuitStyleDeleteThisItem = (e, i) => {
    let oldStylesObject = SuitstylesArray;
    delete oldStylesObject["suit" + "_" + i];

    let newStylesObject = {};
    let m = 0;
    for (let x of Object.keys(oldStylesObject)) {
      newStylesObject["suit" + "_" + m] = oldStylesObject[x];

      m = m + 1;
    }
    suitOrderQuantityArray.pop();
    setSuitstylesArray({ ...newStylesObject });
    props.setJacketCount(props.jacketCount - 1);
    props.setTotalQuantity(props.jacketCount - 1);
    props.setOrders([...props.orders]);
  };

  const handleSuitChangeInput = (event, i) => {

    const itemNameID = "suit" + "_" + i;

    if (event.target.dataset.for == "monogram") {
      if (SuitstylesArray[itemNameID]["jacket"]["monogram"]) {
        SuitstylesArray[itemNameID]["jacket"]["monogram"][event.target.name] =
          event.target.value;
        setSuitstylesArray({ ...SuitstylesArray });
      } else {
        const object = {};
        object[event.target.name] = event.target.value;
        SuitstylesArray[itemNameID]["jacket"]["monogram"] = object;
        setSuitstylesArray({ ...SuitstylesArray });
      }
    } else {
      SuitstylesArray[itemNameID]["jacket"][event.target.name] = event.target.value;
      setSuitstylesArray({ ...SuitstylesArray });
    }
  };

  const handleSuitPipingInput = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name.split("_")[0];
    SuitstylesArray[itemNameID]["jacket"][name] = e.target.value;
    setSuitstylesArray({ ...SuitstylesArray });
  };

  const handleSuitFabricNoteInput = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name;
    SuitstylesArray[itemNameID][name] = e.target.value;
    setSuitstylesArray({ ...SuitstylesArray });
  };

  const handleSuitFabricInput = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name;
    SuitstylesArray[itemNameID][name] = e.target.value;
    setSuitstylesArray({ ...SuitstylesArray });
  };

  const handleSuitMonogramSideChange = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (SuitstylesArray[itemNameID]["jacket"]["monogram"]) {
        SuitstylesArray[itemNameID]["jacket"]["monogram"][name] =
          e.target.value;
        setSuitstylesArray({ ...SuitstylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        SuitstylesArray[itemNameID]["jacket"]["monogram"] = object;
        setSuitstylesArray({ ...SuitstylesArray });
      }
    }
  };

  const handleSuitMonogramFontstyleChange = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (SuitstylesArray[itemNameID]["jacket"]["monogram"]) {
        SuitstylesArray[itemNameID]["jacket"]["monogram"][name] =
          e.target.value;
        setSuitstylesArray({ ...SuitstylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        SuitstylesArray[itemNameID]["jacket"]["monogram"] = object;
        setSuitstylesArray({ ...SuitstylesArray });
      }
    }
  };

  const handleSuitMonogramColorChange = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (SuitstylesArray[itemNameID]["jacket"]["monogram"]) {
        SuitstylesArray[itemNameID]["jacket"]["monogram"][name] =
          e.target.value;
        setSuitstylesArray({ ...SuitstylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        SuitstylesArray[itemNameID]["jacket"]["monogram"] = object;
        setSuitstylesArray({ ...SuitstylesArray });
      }
    }
  };

  const handleSuitCopyStyleData = (e, i) => {
    if (e.target.checked) {
      const itemIDcurrent = "suit" + "_" + i;
      const itemIDprevious = "suit" + "_" + (i - 1);

      const newObject = JSON.parse(JSON.stringify(SuitstylesArray[itemIDprevious]));
      SuitstylesArray[itemIDcurrent] = newObject
      setSuitstylesArray({ ...SuitstylesArray });
    } else {
      const itemIDcurrent = "suit" + "_" + i;
      SuitstylesArray[itemIDcurrent] = {};
      setSuitstylesArray({ ...SuitstylesArray });
    }
  };

  // handle image upload----------------------------

  //------------------- tuxedo style handle ----------------- //

  const handleTuxedoStyleDeleteThisItem = (e, i) => {
    let oldStylesObject = TuxedostylesArray;
    delete oldStylesObject["tuxedo" + "_" + i];

    let newStylesObject = {};
    let m = 0;
    for (let x of Object.keys(oldStylesObject)) {
      newStylesObject["tuxedo" + "_" + m] = oldStylesObject[x];

      m = m + 1;
    }
    tuxeodOrderQuantityArray.pop();
    setTuxedostylesArray({ ...newStylesObject });
    props.setJacketCount(props.jacketCount - 1);
    props.setTotalQuantity(props.jacketCount - 1);
    props.setOrders([...props.orders]);
  };

  const handleTuxedoChangeInput = (event, i) => {

    const itemNameID = "tuxedo" + "_" + i;

    if (event.target.dataset.for == "monogram") {
      if (TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"]) {
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"][event.target.name] =
          event.target.value;
        setTuxedostylesArray({ ...TuxedostylesArray });
      } else {
        const object = {};
        object[event.target.name] = event.target.value;
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"] = object;
        setTuxedostylesArray({ ...TuxedostylesArray });
      }
    } else {
      TuxedostylesArray[itemNameID]["tuxedojacket"][event.target.name] = event.target.value;
      setTuxedostylesArray({ ...TuxedostylesArray });
    }
  };

  const handleTuxedoPipingInput = (e, i) => {
    const itemNameID = "tuxedo" + "_" + i;
    const name = e.target.name.split("_")[0];
    TuxedostylesArray[itemNameID]["tuxedojacket"][name] = e.target.value;
    setTuxedostylesArray({ ...TuxedostylesArray });
  };

  const handleTuxedoFabricNoteInput = (e, i) => {
    const itemNameID = "tuxedo" + "_" + i;
    const name = e.target.name;
    TuxedostylesArray[itemNameID][name] = e.target.value;
    setTuxedostylesArray({ ...TuxedostylesArray });
  };

  const handleTuxedoFabricInput = (e, i) => {
    const itemNameID = "tuxedo" + "_" + i;
    const name = e.target.name;
    TuxedostylesArray[itemNameID][name] = e.target.value;
    setTuxedostylesArray({ ...TuxedostylesArray });
  };

  const handleTuxedoMonogramSideChange = (e, i) => {
    const itemNameID = "suit" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (SuitstylesArray[itemNameID]["jacket"]["monogram"]) {
        SuitstylesArray[itemNameID]["jacket"]["monogram"][name] =
          e.target.value;
        setSuitstylesArray({ ...SuitstylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        SuitstylesArray[itemNameID]["jacket"]["monogram"] = object;
        setSuitstylesArray({ ...SuitstylesArray });
      }
    }
  };

  const handleTuxedoMonogramFontstyleChange = (e, i) => {
    const itemNameID = "tuxedo" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"]) {
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"][name] =
          e.target.value;
        setTuxedostylesArray({ ...TuxedostylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"] = object;
        setTuxedostylesArray({ ...TuxedostylesArray });
      }
    }
  };

  const handleTuxedoMonogramColorChange = (e, i) => {
    const itemNameID = "tuxedo" + "_" + i;
    const name = e.target.name.split("_")[0];
    if (e.target.dataset.for == "monogram") {
      if (TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"]) {
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"][name] =
          e.target.value;
        setTuxedostylesArray({ ...TuxedostylesArray });
      } else {
        const object = {};
        object[name] = e.target.value;
        TuxedostylesArray[itemNameID]["tuxedojacket"]["monogram"] = object;
        setTuxedostylesArray({ ...TuxedostylesArray });
      }
    }
  };

  const handleTuxedoCopyStyleData = (e, i) => {
    if (e.target.checked) {
      const itemIDcurrent = "tuxedo" + "_" + i;
      const itemIDprevious = "tuxedo" + "_" + (i - 1);

      const newObject = JSON.parse(JSON.stringify(TuxedostylesArray[itemIDprevious]));
      TuxedostylesArray[itemIDcurrent] = newObject
      setTuxedostylesArray({ ...TuxedostylesArray });
    } else {
      const itemIDcurrent = "suit" + "_" + i;
      TuxedostylesArray[itemIDcurrent] = {};
      setTuxedostylesArray({ ...TuxedostylesArray });
    }
  };

  // handle image upload----------------------------

  const handleImageUpload = async (e, i) => {
    const itemNameID = product.name + "_" + i;
    if (imageData) {
      const data = new FormData();
      data.append("image", imageData);
      const res = await axiosInstance.post("image/upload", data)
      setImageData(null)
      stylesArray[itemNameID]['referance_image'] = res.data.data
    }
  }

  // handleImage upload for suits

  const handleImageUploadSuit = async (e, i) => {
    const itemNameID = "suit_" + i;
    if (imageDataSuit) {
      const data = new FormData();
      data.append("image", imageDataSuit);
      const res = await axiosInstance.post("image/upload", data)
      setImageDataSuit(null)
      SuitstylesArray[itemNameID]['referance_image'] = res.data.data
      // stylesArray[itemNameID]['referance_image'] = `${res.data.data.split("/")[1]}.png`
    }
    // if (imageDataJacket) {
    //   const data = new FormData();
    //   data.append("image", imageDataJacket);
    //   const res = await axiosInstance.post("image/upload", data)
    //   setImageDataJacket(null)
    //   SuitstylesArray[itemNameID]['jacket']['referance_image'] = `${res.data.data.split("/")[1]}.png`
    //   // stylesArray[itemNameID]['referance_image'] = `${res.data.data.split("/")[1]}.png`
    // }
    // if (imageDataPant) {
    //   const data = new FormData();
    //   data.append("image", imageDataPant);
    //   const res = await axiosInstance.post("image/upload", data)
    //   setImageDataPant(null)
    //   SuitstylesArray[itemNameID]['pant']['referance_image'] = `${res.data.data.split("/")[1]}.png`
    // }
  }
  //------------------- END ----------------- //
  // handleImage upload for Tuxedo

  const handleImageUploadTuxedo = async (e, i) => {
    const itemNameID = "tuxedo" + i;
    if (imageDataTuxedo) {
      const data = new FormData();
      data.append("image", imageDataTuxedo);
      const res = await axiosInstance.post("image/upload", data)
      setImageDataTuxedo(null)
      TuxedostylesArray[itemNameID]['referance_image'] = res.data.data
      // stylesArray[itemNameID]['referance_image'] = `${res.data.data.split("/")[1]}.png`
    }
    // if (imageDataJacket) {
    //   const data = new FormData();
    //   data.append("image", imageDataJacket);
    //   const res = await axiosInstance.post("image/upload", data)
    //   setImageDataJacket(null)
    //   SuitstylesArray[itemNameID]['jacket']['referance_image'] = `${res.data.data.split("/")[1]}.png`
    //   // stylesArray[itemNameID]['referance_image'] = `${res.data.data.split("/")[1]}.png`
    // }
    // if (imageDataPant) {
    //   const data = new FormData();
    //   data.append("image", imageDataPant);
    //   const res = await axiosInstance.post("image/upload", data)
    //   setImageDataPant(null)
    //   SuitstylesArray[itemNameID]['pant']['referance_image'] = `${res.data.data.split("/")[1]}.png`
    // }
  }

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSuccess(false);
    setOpen(false);
    setError(false);
  };

  const action = (
    <React.Fragment>
      <Button color="secondary" size="small" onClick={handleClose}>
        UNDO
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleClose}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </React.Fragment>
  );

  return (
    <main className="main-panel">
      <div className="content-wrapper pd-1r">
        <div
          className="missing-fabric-top"
          style={{ justifyContent: "space-between" }}
        >
          <h3>Style Information</h3>
          <p>
            Customer Name :-
            <strong>{props.customerName + " " + props.customerLastName}</strong>
          </p>
        </div>
        {orderQuantityArray.map((quantities, i) => {
          return (
            <>
              <button
                data-name={i}
                onClick={(e) => handleDeleteThisItem(e, i)}
                className="delete-Btn"
              >
                Delete
              </button>
              <Accordion
                expanded={expanded === `p1${i}`}
                onChange={handleChange(`p1${i}`)}
                className="Accrodian-main "
              >
                <AccordionSummary
                  aria-controls="panel1d-content"
                  id="panel1d-header"
                  className="sidebarmenu fabric_infoNM"
                >
                  <span>
                    Fabric Information for{" "}
                    <strong>
                      {styleObject["item_name"].charAt(0).toUpperCase() +
                        styleObject["item_name"].slice(1)}{" "}
                      {" - " + (i + 1)}
                    </strong>
                  </span>
                </AccordionSummary>

                <AccordionDetails className="information-accrodian">
                  <div
                    className="missing-fabric-wrapperMain"
                    style={{ alignItems: "self-start" }}
                  >
                    <div className="fabric-left  pl_15">
                      <form>
                        <hr></hr>
                        <div className="title-fabrics">
                          <h3> Main Fabric </h3>
                          {i > 0 ? (
                            <div className="copyCheckDiv">
                              {" "}
                              <input
                                type="checkbox"
                                id="copyCheck"
                                onChange={(e) => handleCopyStyleData(e, i)}
                              />{" "}
                              <label for="copyCheck">
                                <strong>
                                  Copy Styles of the previous Item.
                                </strong>
                              </label>
                            </div>
                          ) : (
                            <></>
                          )}
                        </div>
                        <div className="form-group ">
                          {/* <label> Fabric form Retailer </label> */}
                          <input
                            type="text"
                            className="searchinput"
                            name="fabric_code"
                            // value={styleObject.fabric_code}
                            value={
                              stylesArray[product.name + "_" + i]["fabric_code"]
                                ? stylesArray[product.name + "_" + i][
                                "fabric_code"
                                ]
                                : ""
                            }
                            // value="fabricName"
                            placeholder="Enter Your Fabric"
                            onChange={(event) => handleChangeInput(event, i)}
                          ></input>
                        </div>
                        <hr></hr>
                        {product["name"] == "pant" ? (
                          <></>
                        ) : product["name"] == "shirt" ? (
                          <>


                            <div className="title-fabrics" style={{ display: 'flex', flexDirection: 'row' }}>
                              {" "}
                              <div><h3> Monogram </h3></div>
                              {" "}
                              <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                                <label for="skipMonogram"><strong>Skip Monogram</strong></label>
                                <input type="checkbox" id="skipMonogram" checked={showMonogram[i]} onChange={(e) => handleShirtMonogram(e, i)} />
                              </div>
                            </div>

                            {!showMonogram[i] ?
                              <>
                                <div className="form-group monogram-info">
                                  {/* <p> Monogram </p> */}
                                  <input
                                    type="text"
                                    className="searchinput"
                                    placeholder="Tag"
                                    name="tag"
                                    value={
                                      stylesArray[product.name + "_" + i].monogram
                                        ? stylesArray[product.name + "_" + i]
                                          .monogram.tag
                                        : ""
                                    }
                                    data-for="monogram"
                                    onChange={(event) =>
                                      handleChangeInput(event, i)
                                    }
                                  ></input>
                                </div>
                                <div className="form-group monogram-info">
                                  <p> Monogram Position </p>
                                  <ul>
                                    <li>
                                      <input
                                        type="radio"
                                        name={"side" + "_" + i}
                                        data-for="monogram"
                                        data-newname="side"
                                        value="left side"
                                        id={"myCheckbox0a1" + "_" + i}
                                        checked={
                                          stylesArray[product.name + "_" + i]
                                            .monogram &&
                                            stylesArray[product.name + "_" + i]
                                              .monogram["side"] == "left side"
                                            ? true
                                            : false
                                        }
                                        onChange={(event) =>
                                          handleMonogramSideChange(event, i)
                                        }
                                      />
                                      <label for={"myCheckbox0a1" + "_" + i}>
                                        <h5> Left Side </h5>
                                      </label>
                                    </li>
                                    {/* <li>
                                  <input
                                    type="radio"
                                    name={"side" + "_" + i}
                                    data-for="monogram"
                                    data-newname="side"
                                    value="right side"
                                    checked={
                                      stylesArray[product.name + "_" + i]
                                        .monogram &&
                                        stylesArray[product.name + "_" + i]
                                          .monogram["side"] == "right side"
                                        ? true
                                        : false
                                    }
                                    id={"myCheckbox0a2" + "_" + i}
                                    onChange={(event) =>
                                      handleMonogramSideChange(event, i)
                                    }
                                  />
                                  <label for={"myCheckbox0a2" + "_" + i}>
                                    <h5> Right Side </h5>
                                  </label>
                                </li> */}
                                  </ul>
                                </div>
                                <div className="form-group monogram-foont-style">
                                  <p> Monogram Font Style </p>
                                  <ul>
                                    {fontStyle.map((fontStyles, key) => {
                                      return (
                                        <li key={key}>
                                          <input
                                            type="radio"
                                            name={"font_style_" + i}
                                            checked={
                                              stylesArray[product.name + "_" + i]
                                                .monogram &&
                                                stylesArray[product.name + "_" + i]
                                                  .monogram.font ==
                                                fontStyles.styleName
                                                ? true
                                                : false
                                            }
                                            data-for="monogram"
                                            value={fontStyles.styleName}
                                            id={
                                              "myCheckboxb" +
                                              fontStyles.styleName +
                                              "_" +
                                              i
                                            }
                                            onChange={(event) =>
                                              handleMonogramFontstyleChange(
                                                event,
                                                i
                                              )
                                            }
                                          />
                                          <label
                                            for={
                                              "myCheckboxb" +
                                              fontStyles.styleName +
                                              "_" +
                                              i
                                            }
                                          >
                                            <img
                                              src={fontStyles.image}
                                              alt="Monogram Font Style"
                                            />
                                            <p> {fontStyles.styleName} </p>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                                <div className="form-group colored-style-boX">
                                  <p> Monogram Color </p>
                                  {colorData !== null && colorData.length > 0 ? (
                                    <ul
                                      style={{
                                        display: "block",
                                        overflowY: "auto",
                                        height: "400px",
                                      }}
                                    >
                                      {colorData.map((data, key) => (
                                        <li key={key}>
                                          <input
                                            type="radio"
                                            className="radio"
                                            name={"color" + "_" + i}
                                            data-for="monogram"
                                            style={{ display: "none" }}
                                            id={data.id + "_" + i}
                                            checked={
                                              stylesArray[product.name + "_" + i]
                                                .monogram &&
                                                stylesArray[product.name + "_" + i]
                                                  .monogram["color"] == data.value
                                                ? true
                                                : false
                                            }
                                            value={data.value}
                                            onChange={(event) =>
                                              handleMonogramColorChange(event, i)
                                            }
                                            defaultChecked={false}
                                          />
                                          <label for={data.id + "_" + i}>
                                            <div
                                              className="colored-boxes"
                                              style={{
                                                backgroundColor: `${data.color}`,
                                              }}
                                            ></div>{" "}
                                            <p> {data.value} </p>
                                          </label>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <>
                                      <p>No data found</p>
                                    </>
                                  )}
                                </div></>
                              :
                              <></>

                            }


                            <hr></hr>
                          </>
                        ) : product["name"] == "jacket" ? (
                          <>
                            <div className="title-fabrics">
                              <h3> Lining </h3>
                            </div>
                            <div className="form-group">
                              {/* <p> Fabric form Retailer </p> */}
                              <input
                                type="text"
                                className="searchinput"
                                name="lining_code"
                                value={
                                  stylesArray[product.name + "_" + i][
                                    "lining_code"
                                  ]
                                    ? stylesArray[product.name + "_" + i][
                                    "lining_code"
                                    ]
                                    : ""
                                }
                                // value={styleObject.lining_code}
                                // value="lining"
                                placeholder="Enter Your Lining"
                                onChange={(event) =>
                                  handleChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Piping </h3>
                            </div>
                            <div className="form-group colored-style-boX">
                              {piping !== null && piping.length > 0 ? (
                                <ul
                                  style={{
                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",
                                  }}
                                >
                                  {piping.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"piping_" + i}
                                        data-name={data.pipingCode}
                                        id={data._id + "_" + i}
                                        value={data.pipingCode}
                                        style={{ display: "none" }}
                                        onChange={(event) =>
                                          handlePipingInput(event, i)
                                        }
                                        checked={
                                          stylesArray[product.name + "_" + i][
                                            "piping"
                                          ] == data.pipingCode
                                            ? true
                                            : false
                                        }
                                      // defaultChecked={false}
                                      />
                                      <label for={data._id + "_" + i}>
                                        <div
                                          className="colored-boxes"
                                        // style={{ backgroundColor: "#cd3534" }}
                                        >
                                          <img
                                            // src={`https://res.cloudinary.com/di5etqzhu/image/upload/v1667389732/images/${data.image}`}PicBaseUrl
                                            src={PicBaseUrl + data.image}
                                            //  width={40} height={40}
                                            style={{
                                              width: "60px",
                                              height: "60px",
                                              borderRadius: "11px",
                                            }}
                                          />
                                        </div>
                                        <p> {data.pipingCode} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              {" "}
                              <h3> Monogram </h3>{" "}
                            </div>
                            <div className="form-group monogram-info">
                              {/* <p> Monogram </p> */}
                              <input
                                type="text"
                                className="searchinput"
                                placeholder="Tag"
                                name="tag"
                                value={
                                  stylesArray[product.name + "_" + i].monogram
                                    ? stylesArray[product.name + "_" + i]
                                      .monogram.tag
                                    : ""
                                }
                                data-for="monogram"
                                onChange={(event) =>
                                  handleChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            <div className="form-group monogram-foont-style">
                              <p> Monogram Font Style </p>
                              <ul>
                                {fontStyle.map((fontStyles, key) => {
                                  return (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"font_style_" + i}
                                        checked={
                                          stylesArray[product.name + "_" + i]
                                            .monogram &&
                                            stylesArray[product.name + "_" + i]
                                              .monogram.font ==
                                            fontStyles.styleName
                                            ? true
                                            : false
                                        }
                                        data-for="monogram"
                                        value={fontStyles.styleName}
                                        id={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                        onChange={(event) =>
                                          handleMonogramFontstyleChange(
                                            event,
                                            i
                                          )
                                        }
                                      />
                                      <label
                                        for={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                      >
                                        <img
                                          src={fontStyles.image}
                                          alt="Monogram Font Style"
                                        />
                                        <p> {fontStyles.styleName} </p>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="form-group colored-style-boX">
                              <p> Monogram Color </p>
                              {colorData !== null && colorData.length > 0 ? (
                                <ul
                                  style={{
                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",
                                  }}
                                >
                                  {colorData.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        className="radio"
                                        name={"color" + "_" + i}
                                        data-for="monogram"
                                        style={{ display: "none" }}
                                        id={data.id + "_" + i}
                                        checked={
                                          stylesArray[product.name + "_" + i]
                                            .monogram &&
                                            stylesArray[product.name + "_" + i]
                                              .monogram["color"] == data.value
                                            ? true
                                            : false
                                        }
                                        value={data.value}
                                        onChange={(event) =>
                                          handleMonogramColorChange(event, i)
                                        }
                                        defaultChecked={false}
                                      />
                                      <label for={data.id + "_" + i}>
                                        <div
                                          className="colored-boxes"
                                          style={{
                                            backgroundColor: `${data.color}`,
                                          }}
                                        ></div>{" "}
                                        <p> {data.value} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>


                            <hr></hr>
                          </>
                        ) : (
                          <>
                            <div className="title-fabrics">
                              <h3> Lining </h3>
                            </div>
                            <div className="form-group">
                              {/* <p> Fabric form Retailer </p> */}
                              <input
                                type="text"
                                className="searchinput"
                                name="lining_code"
                                value={
                                  stylesArray[product.name + "_" + i][
                                    "lining_code"
                                  ]
                                    ? stylesArray[product.name + "_" + i][
                                    "lining_code"
                                    ]
                                    : ""
                                }
                                // value={styleObject.lining_code}
                                // value="lining"
                                placeholder="Enter Your Lining"
                                onChange={(event) =>
                                  handleChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Piping </h3>
                            </div>
                            <div className="form-group colored-style-boX">
                              {piping !== null && piping.length > 0 ? (
                                <ul
                                  style={{
                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",
                                  }}
                                >
                                  {piping.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"piping_" + i}
                                        data-name={data.pipingCode}
                                        id={data._id + "_" + i}
                                        value={data.pipingCode}
                                        style={{ display: "none" }}
                                        onChange={(event) =>
                                          handlePipingInput(event, i)
                                        }
                                        checked={
                                          stylesArray[product.name + "_" + i][
                                            "piping"
                                          ] == data.pipingCode
                                            ? true
                                            : false
                                        }
                                      // defaultChecked={false}
                                      />
                                      <label for={data._id + "_" + i}>
                                        <div
                                          className="colored-boxes"
                                        // style={{ backgroundColor: "#cd3534" }}
                                        >
                                          <img
                                            // src={`https://res.cloudinary.com/di5etqzhu/image/upload/v1667389732/images/${data.image}`}PicBaseUrl
                                            src={PicBaseUrl + data.image}
                                            //  width={40} height={40}
                                            style={{
                                              width: "60px",
                                              height: "60px",
                                              borderRadius: "11px",
                                            }}
                                          />
                                        </div>
                                        <p> {data.pipingCode} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>
                            <hr></hr>
                            {product['name'] !== 'vest'
                              ?
                              <>
                                <div className="title-fabrics">
                                  {" "}
                                  <h3> Monogram </h3>{" "}
                                </div>
                                <div className="form-group monogram-info">
                                  {/* <p> Monogram </p> */}
                                  <input
                                    type="text"
                                    className="searchinput"
                                    placeholder="Tag"
                                    name="tag"
                                    value={
                                      stylesArray[product.name + "_" + i].monogram
                                        ? stylesArray[product.name + "_" + i]
                                          .monogram.tag
                                        : ""
                                    }
                                    data-for="monogram"
                                    onChange={(event) =>
                                      handleChangeInput(event, i)
                                    }
                                  ></input>
                                </div>
                                <div className="form-group monogram-info">
                                  <p> Monogram Position </p>
                                  <ul>
                                    <li>
                                      <input
                                        type="radio"
                                        name={"side" + "_" + i}
                                        data-for="monogram"
                                        data-newname="side"
                                        value="left side"
                                        id={"myCheckbox0a1" + "_" + i}
                                        checked={
                                          stylesArray[product.name + "_" + i]
                                            .monogram &&
                                            stylesArray[product.name + "_" + i]
                                              .monogram["side"] == "left side"
                                            ? true
                                            : false
                                        }
                                        onChange={(event) =>
                                          handleMonogramSideChange(event, i)
                                        }
                                      />
                                      <label for={"myCheckbox0a1" + "_" + i}>
                                        <h5> Left Side </h5>
                                      </label>
                                    </li>
                                    <li>
                                      <input
                                        type="radio"
                                        name={"side" + "_" + i}
                                        data-for="monogram"
                                        data-newname="side"
                                        value="right side"
                                        checked={
                                          stylesArray[product.name + "_" + i]
                                            .monogram &&
                                            stylesArray[product.name + "_" + i]
                                              .monogram["side"] == "right side"
                                            ? true
                                            : false
                                        }
                                        id={"myCheckbox0a2" + "_" + i}
                                        onChange={(event) =>
                                          handleMonogramSideChange(event, i)
                                        }
                                      />
                                      <label for={"myCheckbox0a2" + "_" + i}>
                                        <h5> Right Side </h5>
                                      </label>
                                    </li>
                                  </ul>
                                </div>
                                <div className="form-group monogram-foont-style">
                                  <p> Monogram Font Style </p>
                                  <ul>
                                    {fontStyle.map((fontStyles, key) => {
                                      return (
                                        <li key={key}>
                                          <input
                                            type="radio"
                                            name={"font_style_" + i}
                                            checked={
                                              stylesArray[product.name + "_" + i]
                                                .monogram &&
                                                stylesArray[product.name + "_" + i]
                                                  .monogram.font ==
                                                fontStyles.styleName
                                                ? true
                                                : false
                                            }
                                            data-for="monogram"
                                            value={fontStyles.styleName}
                                            id={
                                              "myCheckboxb" +
                                              fontStyles.styleName +
                                              "_" +
                                              i
                                            }
                                            onChange={(event) =>
                                              handleMonogramFontstyleChange(
                                                event,
                                                i
                                              )
                                            }
                                          />
                                          <label
                                            for={
                                              "myCheckboxb" +
                                              fontStyles.styleName +
                                              "_" +
                                              i
                                            }
                                          >
                                            <img
                                              src={fontStyles.image}
                                              alt="Monogram Font Style"
                                            />
                                            <p> {fontStyles.styleName} </p>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                                <div className="form-group colored-style-boX">
                                  <p> Monogram Color </p>
                                  {colorData !== null && colorData.length > 0 ? (
                                    <ul
                                      style={{
                                        display: "block",
                                        overflowY: "auto",
                                        height: "400px",
                                      }}
                                    >
                                      {colorData.map((data, key) => (
                                        <li key={key}>
                                          <input
                                            type="radio"
                                            className="radio"
                                            name={"color" + "_" + i}
                                            data-for="monogram"
                                            style={{ display: "none" }}
                                            id={data.id + "_" + i}
                                            checked={
                                              stylesArray[product.name + "_" + i]
                                                .monogram &&
                                                stylesArray[product.name + "_" + i]
                                                  .monogram["color"] == data.value
                                                ? true
                                                : false
                                            }
                                            value={data.value}
                                            onChange={(event) =>
                                              handleMonogramColorChange(event, i)
                                            }
                                            defaultChecked={false}
                                          />
                                          <label for={data.id + "_" + i}>
                                            <div
                                              className="colored-boxes"
                                              style={{
                                                backgroundColor: `${data.color}`,
                                              }}
                                            ></div>{" "}
                                            <p> {data.value} </p>
                                          </label>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <>
                                      <p>No data found</p>
                                    </>
                                  )}
                                </div>
                              </>
                              :
                              <></>}


                            <hr></hr>
                          </>
                        )}

                        <div className="title-fabrics">
                          <h3>Normal styles</h3>
                        </div>
                        <div className="title-fabrics">

                          {features
                            ?
                            <Styles
                              featuresStyle={features}
                              stylesArray={stylesArray}
                              setStylesArray={setStylesArray}
                              product={product}
                              productIndex={i}
                            />
                            :
                            <></>
                          }
                        </div>

                        <div className="title-fabrics">
                          <h3>Additional styles</h3>
                          <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                            <label for={i}><strong>Show Additional styles</strong></label>
                            <input type="checkbox" id={i} checked={showAdditionalStyles[i]} onChange={(e) => handleShowAdditionalStyles(e, i)} />
                          </div>
                        </div>
                        <div className="title-fabrics">

                          {features && showAdditionalStyles[i]
                            ?
                            <AdditionalStyles
                              featuresStyle={features}
                              stylesArray={stylesArray}
                              setStylesArray={setStylesArray}
                              product={product}
                              productIndex={i}
                              normalStyleCount={normalStyleCount}
                            />
                            :
                            <></>
                          }
                        </div>



                        <div className="form-group pd-top-15p">
                          <label>
                            {" "}
                            <h3>Note</h3>{" "}
                          </label>
                          <textarea
                            className="searchinput"
                            name="note"
                            // value={styleObject.fabric_code}
                            value={
                              stylesArray[product.name + "_" + i]["note"]
                                ? stylesArray[product.name + "_" + i]["note"]
                                : ""
                            }
                            placeholder="Special note (if any)"
                            onChange={(e) => handleChangeInput(e, i)}

                          // id={feature._id}
                          ></textarea>
                        </div>

                        <div className="form-group ">
                          <div className="title-fabrics">
                            <h3> Reference Image </h3>
                          </div>
                          <label htmlFor="fileInput">

                            {
                              imageData
                                ?
                                <img
                                  style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                  src={URL.createObjectURL(imageData)} alt="" className='uploaded-image' />
                                :
                                stylesArray[product['name'] + "_" + i]['referance_image'] && stylesArray[product['name'] + "_" + i]['referance_image'].length > 0
                                  ?
                                  <img
                                    style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                    src={PicBaseUrl + stylesArray[product['name'] + "_" + i]['referance_image']} alt="" className='uploaded-image' />
                                  :
                                  <img
                                    style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                    src={ImageUpload} alt="" className='uploaded-image' />

                            }


                          </label>

                          <input type="file" name='image' id="fileInput" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageData(e.target.files[0])} />

                          <Button onClick={(e) => handleImageUpload(e, i)}>Upload</Button>
                        </div>
                      </form>
                    </div>

                    <div
                      className="fabric-right"
                      style={{ position: "sticky", top: "0px", height: "auto" }}
                    >
                      <div className="fabric-customer-info">
                        <div className="fabric-accrodian-box">
                          <div className="fabric_info_card">
                            <h4 className="fic_title">
                              {product.name ? product.name.toUpperCase() : " "}
                              <span style={{ marginLeft: "8px" }}>
                                Styling Reference Image
                              </span>
                            </h4>
                            <div className="fi_card_body">
                              <div className="custome_row">
                                <div className="custome_col_6 br_0">
                                  <h5> Image </h5>
                                  <span className="blue_text">
                                    {stylesArray[product.name + "_" + i]["referance_image"]
                                      ?
                                      <img width="50" height="50" src={PicBaseUrl + stylesArray[product.name + "_" + i]["referance_image"]}></img>
                                      : "NA"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="fabric_info_card">
                            <h4 className="fic_title">Fabric Information</h4>
                            <div className="fi_card_body">

                              {product["name"] == "pant" ? (
                                <ul className="custome_row">
                                  <li className="custome_col_6">
                                    <h5> FABRIC </h5>
                                    <span className="blue_text">
                                      {stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                      ]
                                        ? stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                        ]
                                        : "NA"}
                                    </span>
                                  </li>
                                </ul>
                              ) : product["name"] == "shirt" ? (
                                <ul className="custome_row">
                                  <li className="custome_col_6">
                                    <h5> FABRIC </h5>
                                    <span className="blue_text">
                                      {stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                      ]
                                        ? stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                        ]
                                        : "NA"}
                                    </span>
                                  </li>
                                  {stylesArray[product.name + "_" + i][
                                    "monogram"
                                  ]
                                    ? Object.keys(
                                      stylesArray[product.name + "_" + i][
                                      "monogram"
                                      ]
                                    ).map((mono) => {
                                      return (
                                        <li className="custome_col_6">
                                          <h5>{mono.toUpperCase()}</h5>
                                          <span className="blue_text">
                                            {stylesArray[
                                              product.name + "_" + i
                                            ]["monogram"] &&
                                              stylesArray[
                                                product.name + "_" + i
                                              ]["monogram"][mono].length > 0
                                              ? stylesArray[
                                              product.name + "_" + i
                                              ]["monogram"][mono]
                                              : "NA"}
                                          </span>
                                        </li>
                                      );
                                    })
                                    : ""}
                                </ul>
                              ) : (
                                <ul className="custome_row">
                                  <li className="custome_col_6">
                                    <h5> FABRIC </h5>
                                    <span className="blue_text">
                                      {stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                      ]
                                        ? stylesArray[product.name + "_" + i][
                                        "fabric_code"
                                        ]
                                        : "NA"}
                                    </span>
                                  </li>
                                  <li className="custome_col_6">
                                    <h5> LINING </h5>
                                    <span className="blue_text">
                                      {stylesArray[product.name + "_" + i][
                                        "lining_code"
                                      ]
                                        ? stylesArray[product.name + "_" + i][
                                        "lining_code"
                                        ]
                                        : "NA"}
                                    </span>
                                  </li>

                                  <li className="custome_col_6">
                                    <h5> PIPING TYPE </h5>
                                    <span className="blue_text">
                                      {stylesArray[product.name + "_" + i][
                                        "piping"
                                      ]
                                        ? stylesArray[product.name + "_" + i][
                                        "piping"
                                        ]
                                        : "NA"}
                                    </span>
                                  </li>
                                  {stylesArray[product.name + "_" + i][
                                    "monogram"
                                  ]
                                    ? Object.keys(
                                      stylesArray[product.name + "_" + i][
                                      "monogram"
                                      ]
                                    ).map((mono) => {
                                      return (
                                        <li className="custome_col_6">
                                          <h5>{mono.toUpperCase()}</h5>
                                          <span className="blue_text">
                                            {stylesArray[
                                              product.name + "_" + i
                                            ]["monogram"] &&
                                              stylesArray[
                                                product.name + "_" + i
                                              ]["monogram"][mono].length > 0
                                              ? stylesArray[
                                              product.name + "_" + i
                                              ]["monogram"][mono]
                                              : "NA"}
                                          </span>
                                        </li>
                                      );
                                    })
                                    : ""}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div className="fabric_info_card">
                            <h4 className="fic_title">
                              {product.name ? product.name.toUpperCase() : " "}
                              <span style={{ marginLeft: "8px" }}>
                                Styling info
                              </span>
                            </h4>
                            <div className="fi_card_body">
                              <ul className="custome_row">
                                {stylesArray[product.name + "_" + i]["style"]
                                  ? Object.keys(
                                    stylesArray[product.name + "_" + i][
                                    "style"
                                    ]
                                  ).map((mono) => {
                                    return (
                                      <li className="custome_col_6">
                                        <h5>{mono.toUpperCase()}</h5>
                                        <span className="blue_text">
                                          {stylesArray[
                                            product.name + "_" + i
                                          ]["style"] &&
                                            stylesArray[product.name + "_" + i][
                                              "style"
                                            ][mono]["value"].length > 0
                                            ? stylesArray[
                                            product.name + "_" + i
                                            ]["style"][mono]["value"]
                                            : "NA"}
                                        </span>
                                      </li>
                                    );
                                  })
                                  : ""}

                                {stylesArray[product.name + "_" + i]["groupStyle"]
                                  ? Object.keys(
                                    stylesArray[product.name + "_" + i][
                                    "groupStyle"
                                    ]
                                  ).map((styles) => {
                                    return (
                                      <li className="custome_col_12">
                                        <h5>{styles.toUpperCase()}</h5>

                                        <span className="blue_text">
                                          {
                                            Object.keys(
                                              stylesArray[product.name + "_" + i][
                                              "groupStyle"
                                              ][styles]
                                            ).length > 0
                                              ?
                                              stylesArray[
                                              product.name + "_" + i
                                              ]["groupStyle"][styles]['value']

                                              :
                                              ""
                                          }
                                        </span>

                                      </li>
                                    );
                                  })
                                  : ""}
                              </ul>
                            </div>
                          </div>

                          <div className="fabric_info_card">
                            <h4 className="fic_title">
                              {product.name ? product.name.toUpperCase() : " "}
                              <span style={{ marginLeft: "8px" }}>
                                Styling Note info
                              </span>
                            </h4>
                            <div className="fi_card_body">
                              <div className="custome_row">
                                <div className="custome_col_6 br_0">
                                  <h5> Note </h5>
                                  <span className="blue_text">
                                    {stylesArray[product.name + "_" + i]["note"]
                                      ? stylesArray[product.name + "_" + i][
                                      "note"
                                      ]
                                      : "NA"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>
            </>
          );
        })}

        {props.data == "suit" ? (
          <>
            {suitOrderQuantityArray.map((quantities, i) => {
              return (
                <>
                  <button
                    data-name={i}
                    onClick={(e) => handleSuitStyleDeleteThisItem(e, i)}
                    className="delete-Btn"
                  >
                    Delete
                  </button>
                  <Accordion
                    expanded={expanded1 === `p2${i}`}
                    onChange={handleSuitChange(`p2${i}`)}
                    className="Accrodian-main "
                  >
                    <AccordionSummary
                      aria-controls="panel1d-content"
                      id="panel1d-header"
                      className="sidebarmenu fabric_infoNM"
                    >
                      <span>
                        Fabric Information for{" "}
                        <strong>
                          {SuitstyleObject["item_name"]
                            .charAt(0)
                            .toUpperCase() +
                            SuitstyleObject["item_name"].slice(1)}{" "}
                          {" - " + (i + 1)}
                          {""}
                        </strong>
                      </span>
                    </AccordionSummary>
                    <AccordionDetails className="information-accrodian">
                      <div
                        className="missing-fabric-wrapperMain"
                        style={{ alignItems: "self-start" }}
                      >
                        <div className="fabric-left  pl_15">
                          <form>
                            {/* <div style={{display: "flex", flexDirection:"row", justifyContent:"space-around"}}> */}

                            {/* 
                              <div className="form-group ">
                                <div className="title-fabrics">
                                  <h3> Reference Image Pant</h3>
                                </div>
                                <label htmlFor="fileInput">

                                  {
                                      imageDataPant
                                      ?
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={URL.createObjectURL(imageDataPant)} alt="" className='uploaded-image' />
                                      :
                                      SuitstylesArray[product + "_" + i] && SuitstylesArray[product + "_" + i]['pant'] && SuitstylesArray[product + "_" + i]['pant']['referance_image'] && SuitstylesArray[product + "_" + i]['pant']['referance_image'].length > 0
                                        ?
                                        <img
                                          style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                          src={PicBaseUrl + SuitstylesArray[product + "_" + i]['pant']['referance_image']} alt="" className='uploaded-image' />
                                        :
                                        <img
                                          style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                          src={ImageUpload} alt="" className='uploaded-image' />

                                  }


                                </label>

                                <input type="file" name='image1' id="fileInput1" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageDataPant(e.target.files[0])} />

                                <Button onClick={(e) => handleImageUploadSuit(e, i)}>Upload</Button>
                              </div> */}

                            {/* </div> */}

                            <div className="title-fabrics">
                              <h3> Main Fabric </h3>
                              {i > 0 ? (
                                <div className="copyCheckDiv">
                                  <input
                                    type="checkbox"
                                    id="copyCheck"
                                    onChange={(e) =>
                                      handleSuitCopyStyleData(e, i)
                                    }
                                  />{" "}
                                  <label for="copyCheck">
                                    <strong>
                                      Copy Styles of the previous Item.
                                    </strong>
                                  </label>
                                </div>
                              ) : (
                                <></>
                              )}
                            </div>
                            <div className="form-group ">
                              <input
                                type="text"
                                className="searchinput"
                                name="fabric_code"
                                value={
                                  SuitstylesArray["suit" + "_" + i][
                                    "fabric_code"
                                  ]
                                    ? SuitstylesArray["suit" + "_" + i][
                                    "fabric_code"
                                    ]
                                    : ""
                                }
                                placeholder="Enter Your Fabric"
                                onChange={(event) =>
                                  handleSuitFabricInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Lining </h3>
                            </div>
                            <div className="form-group">
                              {/* <p> Fabric form Retailer </p> */}
                              <input
                                type="text"
                                className="searchinput"
                                name="lining_code"
                                value={
                                  SuitstylesArray["suit" + "_" + i] &&
                                    SuitstylesArray["suit" + "_" + i]["jacket"] &&
                                    SuitstylesArray["suit" + "_" + i]["jacket"][
                                    "lining_code"
                                    ]
                                    ? SuitstylesArray["suit" + "_" + i][
                                    "jacket"
                                    ]["lining_code"]
                                    : ""
                                }
                                data-for="jacket"
                                placeholder="Enter Your Lining"
                                onChange={(event) =>
                                  handleSuitChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Piping </h3>
                            </div>
                            <div className="form-group colored-style-boX">
                              {piping !== null && piping.length > 0 ? (
                                <ul
                                  style={{
                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",
                                  }}
                                >
                                  {piping.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"piping_" + i}
                                        data-name={data.pipingCode}
                                        id={data._id + "_" + i}
                                        value={data.pipingCode}
                                        style={{ display: "none" }}
                                        onChange={(event) =>
                                          handleSuitPipingInput(event, i)
                                        }
                                        checked={
                                          SuitstylesArray["suit" + "_" + i] &&
                                            SuitstylesArray["suit" + "_" + i][
                                            "jacket"
                                            ] &&
                                            SuitstylesArray["suit" + "_" + i][
                                            "jacket"
                                            ]["piping"] == data.pipingCode
                                            ? true
                                            : false
                                        }
                                      />
                                      <label for={data._id + "_" + i}>
                                        <div className="colored-boxes">
                                          <img
                                            src={PicBaseUrl + data.image}
                                            style={{
                                              width: "60px",
                                              height: "60px",
                                              borderRadius: "11px",
                                            }}
                                          />
                                        </div>
                                        <p> {data.pipingCode} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              {" "}
                              <h3> Monogram </h3>{" "}
                            </div>
                            <div className="form-group monogram-info">
                              <input
                                type="text"
                                className="searchinput"
                                placeholder="Tag"
                                name="tag"
                                value={
                                  SuitstylesArray["suit" + "_" + i] &&
                                    SuitstylesArray["suit" + "_" + i]["jacket"] &&
                                    SuitstylesArray["suit" + "_" + i]["jacket"][
                                    "monogram"
                                    ]
                                    ? SuitstylesArray["suit" + "_" + i][
                                      "jacket"
                                    ].monogram.tag
                                    : ""
                                }
                                data-for="monogram"
                                onChange={(event) =>
                                  handleSuitChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            {/* <div className="form-group monogram-info">
                              <p> Monogram Position </p>
                              <ul>
                                <li>
                                  <input
                                    type="radio"
                                    name={"side" + "_" + i}
                                    data-for="monogram"
                                    data-newname="side"
                                    value="left side"
                                    id={"myCheckbox0a1" + "_" + i}
                                    checked={
                                      SuitstylesArray["suit" + "_" + i] &&
                                        SuitstylesArray["suit" + "_" + i][
                                        "jacket"
                                        ] &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram["side"] == "left side"
                                        ? true
                                        : false
                                    }
                                    onChange={(event) =>
                                      handleSuitMonogramSideChange(event, i)
                                    }
                                  />
                                  <label for={"myCheckbox0a1" + "_" + i}>
                                    <h5> Left Side </h5>
                                  </label>
                                </li>
                                <li>
                                  <input
                                    type="radio"
                                    name={"side" + "_" + i}
                                    data-for="monogram"
                                    data-newname="side"
                                    value="right side"
                                    checked={
                                      SuitstylesArray["suit" + "_" + i] &&
                                        SuitstylesArray["suit" + "_" + i][
                                        "jacket"
                                        ] &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram["side"] == "right side"
                                        ? true
                                        : false
                                    }
                                    id={"myCheckbox0a2" + "_" + i}
                                    onChange={(event) =>
                                      handleSuitMonogramSideChange(event, i)
                                    }
                                  />
                                  <label for={"myCheckbox0a2" + "_" + i}>
                                    <h5> Right Side </h5>
                                  </label>
                                </li>
                              </ul>
                            </div> */}
                            <div className="form-group monogram-foont-style">
                              <p> Monogram Font Style </p>
                              <ul>
                                {fontStyle.map((fontStyles, key) => {
                                  return (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"font_style_" + i}
                                        checked={
                                          SuitstylesArray["suit" + "_" + i] &&
                                            SuitstylesArray["suit" + "_" + i][
                                            "jacket"
                                            ] &&
                                            SuitstylesArray["suit" + "_" + i][
                                              "jacket"
                                            ].monogram &&
                                            SuitstylesArray["suit" + "_" + i][
                                              "jacket"
                                            ].monogram["font"] ==
                                            fontStyles.styleName
                                            ? true
                                            : false
                                        }
                                        data-for="monogram"
                                        value={fontStyles.styleName}
                                        id={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                        onChange={(event) =>
                                          handleSuitMonogramFontstyleChange(
                                            event,
                                            i
                                          )
                                        }
                                      />
                                      <label
                                        for={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                      >
                                        <img
                                          src={fontStyles.image}
                                          alt="Monogram Font Style"
                                        />
                                        <p> {fontStyles.styleName} </p>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="form-group colored-style-boX">
                              <p> Monogram Color </p>
                              {colorData !== null && colorData.length > 0 ? (
                                <ul
                                  style={{

                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",

                                  }}
                                >
                                  {colorData.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        className="radio"
                                        name={"color" + "_" + i}
                                        data-for="monogram"
                                        style={{ display: "none" }}
                                        id={data.id + "_" + i}
                                        checked={
                                          SuitstylesArray["suit" + "_" + i] &&
                                            SuitstylesArray["suit" + "_" + i][
                                            "jacket"
                                            ] &&
                                            SuitstylesArray["suit" + "_" + i][
                                            "jacket"
                                            ]["monogram"] &&
                                            SuitstylesArray["suit" + "_" + i][
                                              "jacket"
                                            ].monogram["color"] == data.value
                                            ? true
                                            : false
                                        }
                                        value={data.value}
                                        onChange={(event) =>
                                          handleSuitMonogramColorChange(
                                            event,
                                            i
                                          )
                                        }
                                        defaultChecked={false}
                                      />
                                      <label for={data.id + "_" + i}>
                                        <div
                                          className="colored-boxes"
                                          style={{
                                            backgroundColor: `${data.color}`,
                                          }}
                                        ></div>{" "}
                                        <p> {data.value} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>

                            <hr></hr>
                            {Object.keys(SuitJacket).length > 0 ? (
                              <>
                                <div className="title-fabrics">
                                  <h3> {SuitJacket.name.toUpperCase()} : -</h3>
                                </div>
                                <div className="title-fabrics">
                                  <h3> Normal Styles </h3>
                                </div>
                                <SuitStyles
                                  featuresStyle={SuitJacket['features']}
                                  SuitstylesArray={SuitstylesArray}
                                  setSuitstylesArray={setSuitstylesArray}
                                  product="jacket"
                                  productIndex={i}
                                  suitFeaturesNameArray={suitFeaturesNameArray}
                                  suitGroupFeaturesNamesArray={suitGroupFeaturesNamesArray}
                                >

                                </SuitStyles>

                                <div className="title-fabrics">
                                  <h3>Additional Styles </h3>
                                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                                    <label for={"jacket_" + i}><strong>Show Jacket Additional styles</strong></label>
                                    <input type="checkbox" id={"jacket_" + i} checked={showSuitAdditionalStyles['jacket' + "_" + i]} onChange={(e) => handleShowSuitAdditionalStyles(e, i, 'jacket')} />
                                  </div>
                                </div>
                                {showSuitAdditionalStyles['jacket' + "_" + i]
                                  ?
                                  <SuitAdditionalStyles
                                    featuresStyle={SuitJacket['features']}
                                    SuitstylesArray={SuitstylesArray}
                                    setSuitstylesArray={setSuitstylesArray}
                                    product="jacket"
                                    productIndex={i}
                                    normalCount={normalJacketStyleCount}>

                                  </SuitAdditionalStyles>
                                  :
                                  <></>
                                }
                              </>

                            ) : (
                              <></>
                            )}

                            <hr></hr>
                            {Object.keys(SuitPant).length > 0 ? (
                              <>
                                <div className="title-fabrics">
                                  <h3> {SuitPant.name.toUpperCase()} : -</h3>
                                </div>
                                <div className="title-fabrics">
                                  <h3> Normal Styles </h3>
                                </div>
                                <SuitStyles
                                  featuresStyle={SuitPant['features']}
                                  SuitstylesArray={SuitstylesArray}
                                  setSuitstylesArray={setSuitstylesArray}
                                  product="pant"
                                  productIndex={i}
                                  suitFeaturesNameArray={suitFeaturesNameArray}
                                  suitGroupFeaturesNamesArray={suitGroupFeaturesNamesArray}
                                >

                                </SuitStyles>

                                <div className="title-fabrics">
                                  <h3>Additional Styles </h3>
                                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                                    <label for={"pant_" + i}><strong>Show Pant Additional styles</strong></label>
                                    <input type="checkbox" id={"pant_" + i} checked={showSuitAdditionalStyles['pant' + "_" + i]} onChange={(e) => handleShowSuitAdditionalStyles(e, i, 'pant')} />
                                  </div>
                                </div>
                                {showSuitAdditionalStyles['pant' + "_" + i]
                                  ?
                                  <SuitAdditionalStyles
                                    featuresStyle={SuitPant['features']}
                                    SuitstylesArray={SuitstylesArray}
                                    setSuitstylesArray={setSuitstylesArray}
                                    product="pant"
                                    productIndex={i}
                                    normalCount={normalPantStyleCount}>

                                  </SuitAdditionalStyles>
                                  :
                                  <></>
                                }
                              </>

                            ) : (
                              <></>
                            )}


                            <div className="form-group pd-top-15p">
                              <label>
                                {" "}
                                <h3>Note</h3>{" "}
                              </label>
                              <textarea
                                className="searchinput"
                                name="note"
                                value={
                                  SuitstylesArray["suit" + "_" + i]["note"]
                                    ? SuitstylesArray["suit" + "_" + i]["note"]
                                    : ""
                                }
                                placeholder="Special note (if any)"
                                onChange={(e) =>
                                  handleSuitFabricNoteInput(e, i)
                                }
                              ></textarea>
                            </div>
                            <div className="form-group " >

                              <div className="title-fabrics">
                                <h3> Reference Image </h3>
                              </div>
                              <label htmlFor="fileInput">

                                {
                                  imageDataSuit
                                    ?
                                    <img
                                      style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                      src={URL.createObjectURL(imageDataSuit)} alt="" className='uploaded-image' />
                                    :
                                    SuitstylesArray["suit_" + i] && SuitstylesArray["suit_" + i]['referance_image'] && SuitstylesArray["suit_" + i]['referance_image'].length > 0
                                      ?
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={PicBaseUrl + SuitstylesArray["suit_" + i]['referance_image']} alt="" className='uploaded-image' />
                                      :
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={ImageUpload} alt="" className='uploaded-image' />

                                }


                              </label>

                              <input type="file" name='image' id="fileInput" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageDataSuit(e.target.files[0])} />
                              <Button onClick={(e) => handleImageUploadSuit(e, i)}>Upload</Button>
                            </div>
                          </form>
                        </div>

                        <div
                          className="fabric-right"
                          style={{
                            position: "sticky",
                            top: "0px",
                            height: "auto",
                          }}
                        >
                          <div className="fabric-customer-info">
                            <div className="fabric-accrodian-box">
                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  Suit
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling Reference Image
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <div className="custome_row">
                                    <div className="custome_col_6 br_0">
                                      <h5> Image </h5>
                                      <span className="blue_text">
                                        {SuitstylesArray["suit" + "_" + i]["referance_image"]
                                          ?
                                          <img width="50" height="50" src={PicBaseUrl + SuitstylesArray["suit" + "_" + i]["referance_image"]}></img>
                                          : "NA"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="fabric_info_card">
                                <h4 className="fic_title">Fabric Information</h4>

                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    <li className="custome_col_6">
                                      <h5> FABRIC </h5>
                                      <span className="blue_text">
                                        {SuitstylesArray["suit" + "_" + i][
                                          "fabric_code"
                                        ]
                                          ? SuitstylesArray[
                                          "suit" + "_" + i
                                          ]["fabric_code"]
                                          : "NA"}
                                      </span>
                                    </li>
                                    <li className="custome_col_6">
                                      <h5> LINING </h5>
                                      <span className="blue_text">
                                        {SuitstylesArray["suit" + "_" + i]['jacket'] && SuitstylesArray["suit" + "_" + i]['jacket'][
                                          "lining_code"
                                        ]
                                          ? SuitstylesArray[
                                          "suit" + "_" + i
                                          ]['jacket']["lining_code"]
                                          : "NA"}
                                      </span>
                                    </li>

                                    <li className="custome_col_6">
                                      <h5> PIPING TYPE </h5>
                                      <span className="blue_text">
                                        {SuitstylesArray["suit" + "_" + i]['jacket'] && SuitstylesArray["suit" + "_" + i]['jacket'][
                                          "piping"
                                        ]
                                          ? SuitstylesArray[
                                          "suit" + "_" + i
                                          ]['jacket']["piping"]
                                          : "NA"}
                                      </span>
                                    </li>
                                    {SuitstylesArray["suit" + "_" + i]['jacket'] && SuitstylesArray["suit" + "_" + i]['jacket'][
                                      "monogram"
                                    ]
                                      ? Object.keys(
                                        SuitstylesArray["suit" + "_" + i]['jacket'][
                                        "monogram"
                                        ]
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {SuitstylesArray[
                                                "suit" + "_" + i
                                              ]['jacket']["monogram"] &&
                                                SuitstylesArray[
                                                  "suit" + "_" + i
                                                ]['jacket']["monogram"][mono].length > 0
                                                ? SuitstylesArray[
                                                "suit" + "_" + i
                                                ]['jacket']["monogram"][mono]
                                                : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                  </ul>

                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"Jacket"
                                    ? "Jacket".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    {SuitstylesArray["suit" + "_" + i]['jacket'] && SuitstylesArray["suit" + "_" + i]['jacket'][
                                      "style"
                                    ]
                                      ? Object.keys(
                                        SuitstylesArray["suit" + "_" + i]['jacket'][
                                        "style"
                                        ]
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {SuitstylesArray[
                                                "suit" + "_" + i
                                              ]['jacket'] && SuitstylesArray[
                                              "suit" + "_" + i
                                              ]['jacket']["style"] &&
                                                SuitstylesArray[
                                                  "suit" + "_" + i
                                                ]['jacket']["style"][mono]["value"]
                                                  .length > 0
                                                ? SuitstylesArray[
                                                "suit" + "_" + i
                                                ]['jacket']["style"][mono]["value"]
                                                : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}

                                    {SuitstylesArray["suit_" + i] &&
                                      SuitstylesArray["suit_" + i]['jacket'] &&
                                      SuitstylesArray["suit_" + i]['jacket']["groupStyle"]
                                      ? Object.keys(
                                        SuitstylesArray["suit_" + i]['jacket'][
                                        "groupStyle"
                                        ]
                                      ).map((styles) => {
                                        return (
                                          <li className="custome_col_12">
                                            <h5>{styles.toUpperCase()}</h5>

                                            <span className="blue_text">
                                              {
                                                // Object.keys(
                                                //   SuitstylesArray["suit_" + i]['jacket']["groupStyle"][styles]
                                                // ).length > 0
                                                //   ?


                                                SuitstylesArray[
                                                "suit_" + i
                                                ]['jacket']["groupStyle"][styles]['value']



                                                // :
                                                // ""
                                              }

                                            </span>

                                          </li>
                                        );
                                      })
                                      : ""}


                                  </ul>
                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"Pant"
                                    ? "Pant".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    {SuitstylesArray["suit" + "_" + i] && SuitstylesArray["suit" + "_" + i]['pant'] && SuitstylesArray["suit" + "_" + i]['pant']['style']
                                      ? Object.keys(
                                        SuitstylesArray["suit" + "_" + i]['pant']['style']
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {
                                                SuitstylesArray[
                                                  "suit" + "_" + i
                                                ]['pant']
                                                  &&
                                                  SuitstylesArray[
                                                  "suit" + "_" + i
                                                  ]['pant']['style'] &&
                                                  SuitstylesArray[
                                                    "suit" + "_" + i
                                                  ]['pant']['style'][mono]["value"]
                                                    .length > 0
                                                  ? SuitstylesArray[
                                                  "suit" + "_" + i
                                                  ]['pant']['style'][mono]["value"]
                                                  : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                    {SuitstylesArray["suit_" + i] &&
                                      SuitstylesArray["suit_" + i]['pant'] &&
                                      SuitstylesArray["suit_" + i]['pant']["groupStyle"]
                                      ? Object.keys(
                                        SuitstylesArray["suit_" + i]['pant'][
                                        "groupStyle"
                                        ]
                                      ).map((styles) => {
                                        return (
                                          <li className="custome_col_12">
                                            <h5>{styles.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {
                                                // Object.keys(
                                                //   SuitstylesArray["suit_" + i]['pant']["groupStyle"][styles]
                                                // ).length > 0
                                                //   ?


                                                SuitstylesArray[
                                                "suit_" + i
                                                ]['pant']["groupStyle"][styles]['value']


                                                // :
                                                // ""
                                              }

                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                  </ul>
                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"suit"
                                    ? "suit".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling Note info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <div className="custome_row">
                                    <div className="custome_col_6 br_0">
                                      <h5> Note </h5>
                                      <span className="blue_text">
                                        {SuitstylesArray["suit" + "_" + i][
                                          "note"
                                        ]
                                          ? SuitstylesArray["suit" + "_" + i][
                                          "note"
                                          ]
                                          : "NA"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionDetails>
                  </Accordion>
                </>
              );
            })}
          </>
        ) : (
          <></>
        )}

        {props.data == "tuxedo" ? (
          <>
            {tuxeodOrderQuantityArray.map((quantities, i) => {
              return (
                <>
                  <button
                    data-name={i}
                    onClick={(e) => handleTuxedoStyleDeleteThisItem(e, i)}
                    className="delete-Btn"
                  >
                    Delete
                  </button>
                  <Accordion
                    expanded={expanded1 === `p2${i}`}
                    onChange={handleSuitChange(`p2${i}`)}
                    className="Accrodian-main "
                  >
                    <AccordionSummary
                      aria-controls="panel1d-content"
                      id="panel1d-header"
                      className="sidebarmenu fabric_infoNM"
                    >
                      <span>
                        Fabric Information for{" "}
                        <strong>
                          {TuxedostyleObject["item_name"]
                            .charAt(0)
                            .toUpperCase() +
                            TuxedostyleObject["item_name"].slice(1)}{" "}
                          {" - " + (i + 1)}
                          {""}
                        </strong>
                      </span>
                    </AccordionSummary>
                    <AccordionDetails className="information-accrodian">
                      <div
                        className="missing-fabric-wrapperMain"
                        style={{ alignItems: "self-start" }}
                      >
                        <div className="fabric-left  pl_15">
                          <form>
                            {/* <div style={{display: "flex", flexDirection:"row", justifyContent:"space-around"}}> */}

                            {/* 
                              <div className="form-group ">
                                <div className="title-fabrics">
                                  <h3> Reference Image Pant</h3>
                                </div>
                                <label htmlFor="fileInput">

                                  {
                                      imageDataPant
                                      ?
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={URL.createObjectURL(imageDataPant)} alt="" className='uploaded-image' />
                                      :
                                      SuitstylesArray[product + "_" + i] && SuitstylesArray[product + "_" + i]['pant'] && SuitstylesArray[product + "_" + i]['pant']['referance_image'] && SuitstylesArray[product + "_" + i]['pant']['referance_image'].length > 0
                                        ?
                                        <img
                                          style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                          src={PicBaseUrl + SuitstylesArray[product + "_" + i]['pant']['referance_image']} alt="" className='uploaded-image' />
                                        :
                                        <img
                                          style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                          src={ImageUpload} alt="" className='uploaded-image' />

                                  }


                                </label>

                                <input type="file" name='image1' id="fileInput1" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageDataPant(e.target.files[0])} />

                                <Button onClick={(e) => handleImageUploadSuit(e, i)}>Upload</Button>
                              </div> */}

                            {/* </div> */}

                            <div className="title-fabrics">
                              <h3> Main Fabric </h3>
                              {i > 0 ? (
                                <div className="copyCheckDiv">
                                  <input
                                    type="checkbox"
                                    id="copyCheck"
                                    onChange={(e) =>
                                      handleTuxedoCopyStyleData(e, i)
                                    }
                                  />{" "}
                                  <label for="copyCheck">
                                    <strong>
                                      Copy Styles of the previous Item.
                                    </strong>
                                  </label>
                                </div>
                              ) : (
                                <></>
                              )}
                            </div>
                            <div className="form-group ">
                              <input
                                type="text"
                                className="searchinput"
                                name="fabric_code"
                                value={
                                  TuxedostylesArray["tuxedo" + "_" + i][
                                    "fabric_code"
                                  ]
                                    ? TuxedostylesArray["tuxedo" + "_" + i][
                                    "fabric_code"
                                    ]
                                    : ""
                                }
                                placeholder="Enter Your Fabric"
                                onChange={(event) =>
                                  handleTuxedoFabricInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Lining </h3>
                            </div>
                            <div className="form-group">
                              {/* <p> Fabric form Retailer </p> */}
                              <input
                                type="text"
                                className="searchinput"
                                name="lining_code"
                                value={
                                  TuxedostylesArray["tuxedo" + "_" + i] &&
                                    TuxedostylesArray["tuxedo" + "_" + i]["tuxedojacket"] &&
                                    TuxedostylesArray["tuxedo" + "_" + i]["tuxedojacket"][
                                    "lining_code"
                                    ]
                                    ? TuxedostylesArray["tuxedo" + "_" + i][
                                    "tuxedojacket"
                                    ]["lining_code"]
                                    : ""
                                }
                                data-for="tuxedojacket"
                                placeholder="Enter Your Lining"
                                onChange={(event) =>
                                  handleTuxedoChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              <h3> Piping </h3>
                            </div>
                            <div className="form-group colored-style-boX">
                              {piping !== null && piping.length > 0 ? (
                                <ul
                                  style={{
                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",
                                  }}
                                >
                                  {piping.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"piping_" + i}
                                        data-name={data.pipingCode}
                                        id={data._id + "_" + i}
                                        value={data.pipingCode}
                                        style={{ display: "none" }}
                                        onChange={(event) =>
                                          handleTuxedoPipingInput(event, i)
                                        }
                                        checked={
                                          TuxedostylesArray["tuxedo" + "_" + i] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                            "tuxedojacket"
                                            ] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                            "tuxedojacket"
                                            ]["piping"] == data.pipingCode
                                            ? true
                                            : false
                                        }
                                      />
                                      <label for={data._id + "_" + i}>
                                        <div className="colored-boxes">
                                          <img
                                            src={PicBaseUrl + data.image}
                                            style={{
                                              width: "60px",
                                              height: "60px",
                                              borderRadius: "11px",
                                            }}
                                          />
                                        </div>
                                        <p> {data.pipingCode} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>
                            <hr></hr>
                            <div className="title-fabrics">
                              {" "}
                              <h3> Monogram </h3>{" "}
                            </div>
                            <div className="form-group monogram-info">
                              <input
                                type="text"
                                className="searchinput"
                                placeholder="Tag"
                                name="tag"
                                value={
                                  TuxedostylesArray["tuxedo" + "_" + i] &&
                                    TuxedostylesArray["tuxedo" + "_" + i]["tuxedojacket"] &&
                                    TuxedostylesArray["tuxedo" + "_" + i]["tuxedojacket"][
                                    "monogram"
                                    ]
                                    ? TuxedostylesArray["tuxedo" + "_" + i][
                                      "tuxedojacket"
                                    ].monogram.tag
                                    : ""
                                }
                                data-for="monogram"
                                onChange={(event) =>
                                  handleTuxedoChangeInput(event, i)
                                }
                              ></input>
                            </div>
                            {/* <div className="form-group monogram-info">
                              <p> Monogram Position </p>
                              <ul>
                                <li>
                                  <input
                                    type="radio"
                                    name={"side" + "_" + i}
                                    data-for="monogram"
                                    data-newname="side"
                                    value="left side"
                                    id={"myCheckbox0a1" + "_" + i}
                                    checked={
                                      SuitstylesArray["suit" + "_" + i] &&
                                        SuitstylesArray["suit" + "_" + i][
                                        "jacket"
                                        ] &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram["side"] == "left side"
                                        ? true
                                        : false
                                    }
                                    onChange={(event) =>
                                      handleSuitMonogramSideChange(event, i)
                                    }
                                  />
                                  <label for={"myCheckbox0a1" + "_" + i}>
                                    <h5> Left Side </h5>
                                  </label>
                                </li>
                                <li>
                                  <input
                                    type="radio"
                                    name={"side" + "_" + i}
                                    data-for="monogram"
                                    data-newname="side"
                                    value="right side"
                                    checked={
                                      SuitstylesArray["suit" + "_" + i] &&
                                        SuitstylesArray["suit" + "_" + i][
                                        "jacket"
                                        ] &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram &&
                                        SuitstylesArray["suit" + "_" + i][
                                          "jacket"
                                        ].monogram["side"] == "right side"
                                        ? true
                                        : false
                                    }
                                    id={"myCheckbox0a2" + "_" + i}
                                    onChange={(event) =>
                                      handleSuitMonogramSideChange(event, i)
                                    }
                                  />
                                  <label for={"myCheckbox0a2" + "_" + i}>
                                    <h5> Right Side </h5>
                                  </label>
                                </li>
                              </ul>
                            </div> */}
                            <div className="form-group monogram-foont-style">
                              <p> Monogram Font Style </p>
                              <ul>
                                {fontStyle.map((fontStyles, key) => {
                                  return (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        name={"font_style_" + i}
                                        checked={
                                          TuxedostylesArray["tuxedo" + "_" + i] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                            "tuxedojacket"
                                            ] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                              "tuxedojacket"
                                            ].monogram &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                              "tuxedojacket"
                                            ].monogram["font"] ==
                                            fontStyles.styleName
                                            ? true
                                            : false
                                        }
                                        data-for="monogram"
                                        value={fontStyles.styleName}
                                        id={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                        onChange={(event) =>
                                          handleTuxedoMonogramFontstyleChange(
                                            event,
                                            i
                                          )
                                        }
                                      />
                                      <label
                                        for={
                                          "myCheckboxb" +
                                          fontStyles.styleName +
                                          "_" +
                                          i
                                        }
                                      >
                                        <img
                                          src={fontStyles.image}
                                          alt="Monogram Font Style"
                                        />
                                        <p> {fontStyles.styleName} </p>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="form-group colored-style-boX">
                              <p> Monogram Color </p>
                              {colorData !== null && colorData.length > 0 ? (
                                <ul
                                  style={{

                                    display: "block",
                                    overflowY: "auto",
                                    height: "400px",

                                  }}
                                >
                                  {colorData.map((data, key) => (
                                    <li key={key}>
                                      <input
                                        type="radio"
                                        className="radio"
                                        name={"color" + "_" + i}
                                        data-for="monogram"
                                        style={{ display: "none" }}
                                        id={data.id + "_" + i}
                                        checked={
                                          TuxedostylesArray["tuxedo" + "_" + i] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                            "tuxedojacket"
                                            ] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                            "tuxedojacket"
                                            ]["monogram"] &&
                                            TuxedostylesArray["tuxedo" + "_" + i][
                                              "tuxedojacket"
                                            ].monogram["color"] == data.value
                                            ? true
                                            : false
                                        }
                                        value={data.value}
                                        onChange={(event) =>
                                          handleTuxedoMonogramColorChange(
                                            event,
                                            i
                                          )
                                        }
                                        defaultChecked={false}
                                      />
                                      <label for={data.id + "_" + i}>
                                        <div
                                          className="colored-boxes"
                                          style={{
                                            backgroundColor: `${data.color}`,
                                          }}
                                        ></div>{" "}
                                        <p> {data.value} </p>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <p>No data found</p>
                                </>
                              )}
                            </div>

                            <hr></hr>
                            {Object.keys(TuxedoJacket).length > 0 ? (
                              <>
                                <div className="title-fabrics">
                                  <h3> {TuxedoJacket.name.toUpperCase()} : -</h3>
                                </div>
                                <div className="title-fabrics">
                                  <h3> Normal Styles </h3>
                                </div>
                                <TuxedoStyles
                                  featuresStyle={TuxedoJacket['features']}
                                  TuxedostylesArray={TuxedostylesArray}
                                  setTuxedostylesArray={setTuxedostylesArray}
                                  product="tuxedojacket"
                                  productIndex={i}
                                  tuxedoFeaturesNameArray={tuxedoFeaturesNameArray}
                                  tuxedoGroupFeaturesNamesArray={tuxedoGroupFeaturesNamesArray}
                                >

                                </TuxedoStyles>

                                <div className="title-fabrics">
                                  <h3>Additional Styles </h3>
                                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                                    <label for={"tuxedojacket_" + i}><strong>Show Tuxedo Jacket Additional styles</strong></label>
                                    <input type="checkbox" id={"tuxedojacket_" + i} checked={showTuxedoAdditionalStyles['tuxedojacket_' + "_" + i]} onChange={(e) => handleShowTuxedoAdditionalStyles(e, i, 'tuxedojacket_')} />
                                  </div>
                                </div>
                                {showTuxedoAdditionalStyles['tuxedojacket_' + "_" + i]
                                  ?
                                  <TuxedoAdditionalStyles
                                    featuresStyle={TuxedoJacket['features']}
                                    TuxedostylesArray={TuxedostylesArray}
                                    setTuxedostylesArray={setTuxedostylesArray}
                                    product="tuxedojacket"
                                    productIndex={i}
                                    normalCount={normalTuxedoJacketStyleCount}>

                                  </TuxedoAdditionalStyles>
                                  :
                                  <></>
                                }
                              </>

                            ) : (
                              <></>
                            )}

                            <hr></hr>
                            {Object.keys(TuxedoPant).length > 0 ? (
                              <>
                                <div className="title-fabrics">
                                  <h3> {TuxedoPant.name.toUpperCase()} : -</h3>
                                </div>
                                <div className="title-fabrics">
                                  <h3> Normal Styles </h3>
                                </div>
                                <TuxedoStyles
                                  featuresStyle={TuxedoPant['features']}
                                  TuxedostylesArray={TuxedostylesArray}
                                  setTuxedostylesArray={setTuxedostylesArray}
                                  product="pant"
                                  productIndex={i}
                                  tuxedoFeaturesNameArray={tuxedoFeaturesNameArray}
                                  tuxedoGroupFeaturesNamesArray={tuxedoGroupFeaturesNamesArray}
                                >

                                </TuxedoStyles>

                                <div className="title-fabrics">
                                  <h3>Additional Styles </h3>
                                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: "auto" }}>
                                    <label for={"pant_" + i}><strong>Show Pant Additional styles</strong></label>
                                    <input type="checkbox" id={"pant_" + i} checked={showTuxedoAdditionalStyles['pant' + "_" + i]} onChange={(e) => handleShowTuxedoAdditionalStyles(e, i, 'pant')} />
                                  </div>
                                </div>
                                {showTuxedoAdditionalStyles['pant' + "_" + i]
                                  ?
                                  <TuxedoAdditionalStyles
                                    featuresStyle={TuxedoPant['features']}
                                    TuxedostylesArray={TuxedostylesArray}
                                    setTuxedostylesArray={setTuxedostylesArray}
                                    product="pant"
                                    productIndex={i}
                                    normalCount={normalTuxedoPantStyleCount}>

                                  </TuxedoAdditionalStyles>
                                  :
                                  <></>
                                }
                              </>

                            ) : (
                              <></>
                            )}


                            <div className="form-group pd-top-15p">
                              <label>
                                {" "}
                                <h3>Note</h3>{" "}
                              </label>
                              <textarea
                                className="searchinput"
                                name="note"
                                value={
                                  TuxedostylesArray["tuxedo" + "_" + i]["note"]
                                    ? TuxedostylesArray["tuxedo" + "_" + i]["note"]
                                    : ""
                                }
                                placeholder="Special note (if any)"
                                onChange={(e) =>
                                  handleTuxedoFabricNoteInput(e, i)
                                }
                              ></textarea>
                            </div>
                            <div className="form-group " >

                              <div className="title-fabrics">
                                <h3> Reference Image </h3>
                              </div>
                              <label htmlFor="fileInput">

                                {
                                  imageDataTuxedo
                                    ?
                                    <img
                                      style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                      src={URL.createObjectURL(imageDataTuxedo)} alt="" className='uploaded-image' />
                                    :
                                    TuxedostylesArray["tuxedo_" + i] && TuxedostylesArray["tuxedo_" + i]['referance_image'] && TuxedostylesArray["tuxedo_" + i]['referance_image'].length > 0
                                      ?
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={PicBaseUrl + TuxedostylesArray["tuxedo_" + i]['referance_image']} alt="" className='uploaded-image' />
                                      :
                                      <img
                                        style={{ width: "200px", height: "200px", borderRadius: "50%" }}
                                        src={ImageUpload} alt="" className='uploaded-image' />

                                }


                              </label>

                              <input type="file" name='image' id="fileInput" className="inputfile-button" style={{ display: 'none' }} onChange={(e) => setImageDataTuxedo(e.target.files[0])} />
                              <Button onClick={(e) => handleImageUploadTuxedo(e, i)}>Upload</Button>
                            </div>
                          </form>
                        </div>

                        <div
                          className="fabric-right"
                          style={{
                            position: "sticky",
                            top: "0px",
                            height: "auto",
                          }}
                        >
                          <div className="fabric-customer-info">
                            <div className="fabric-accrodian-box">
                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  Suit
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling Reference Image
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <div className="custome_row">
                                    <div className="custome_col_6 br_0">
                                      <h5> Image </h5>
                                      <span className="blue_text">
                                        {TuxedostylesArray["tuxedo" + "_" + i]["referance_image"]
                                          ?
                                          <img width="50" height="50" src={PicBaseUrl + TuxedostylesArray["tuxedo" + "_" + i]["referance_image"]}></img>
                                          : "NA"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="fabric_info_card">
                                <h4 className="fic_title">Fabric Information</h4>

                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    <li className="custome_col_6">
                                      <h5> FABRIC </h5>
                                      <span className="blue_text">
                                        {TuxedostylesArray["tuxedo" + "_" + i][
                                          "fabric_code"
                                        ]
                                          ? TuxedostylesArray[
                                          "tuxedo" + "_" + i
                                          ]["fabric_code"]
                                          : "NA"}
                                      </span>
                                    </li>
                                    <li className="custome_col_6">
                                      <h5> LINING </h5>
                                      <span className="blue_text">
                                        {TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'] && TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                          "lining_code"
                                        ]
                                          ? TuxedostylesArray[
                                          "tuxedo" + "_" + i
                                          ]['tuxedojacket']["lining_code"]
                                          : "NA"}
                                      </span>
                                    </li>

                                    <li className="custome_col_6">
                                      <h5> PIPING TYPE </h5>
                                      <span className="blue_text">
                                        {TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'] && TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                          "piping"
                                        ]
                                          ? TuxedostylesArray[
                                          "tuxedo" + "_" + i
                                          ]['tuxedojacket']["piping"]
                                          : "NA"}
                                      </span>
                                    </li>
                                    {TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'] && TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                      "monogram"
                                    ]
                                      ? Object.keys(
                                        TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                        "monogram"
                                        ]
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {TuxedostylesArray[
                                                "tuxedo" + "_" + i
                                              ]['tuxedojacket']["monogram"] &&
                                                TuxedostylesArray[
                                                  "tuxedo" + "_" + i
                                                ]['tuxedojacket']["monogram"][mono].length > 0
                                                ? TuxedostylesArray[
                                                "tuxedo" + "_" + i
                                                ]['tuxedojacket']["monogram"][mono]
                                                : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                  </ul>

                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"Jacket"
                                    ? "Jacket".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    {TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'] && TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                      "style"
                                    ]
                                      ? Object.keys(
                                        TuxedostylesArray["tuxedo" + "_" + i]['tuxedojacket'][
                                        "style"
                                        ]
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {TuxedostylesArray[
                                                "tuxedo" + "_" + i
                                              ]['tuxedojacket'] && TuxedostylesArray[
                                              "tuxedo" + "_" + i
                                              ]['tuxedojacket']["style"] &&
                                                TuxedostylesArray[
                                                  "tuxedo" + "_" + i
                                                ]['tuxedojacket']["style"][mono]["value"]
                                                  .length > 0
                                                ? TuxedostylesArray[
                                                "tuxedo" + "_" + i
                                                ]['tuxedojacket']["style"][mono]["value"]
                                                : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}

                                    {TuxedostylesArray["tuxedo_" + i] &&
                                      TuxedostylesArray["tuxedo_" + i]['tuxedojacket'] &&
                                      TuxedostylesArray["tuxedo_" + i]['tuxedojacket']["groupStyle"]
                                      ? Object.keys(
                                        TuxedostylesArray["tuxedo_" + i]['tuxedojacket'][
                                        "groupStyle"
                                        ]
                                      ).map((styles) => {
                                        return (
                                          <li className="custome_col_12">
                                            <h5>{styles.toUpperCase()}</h5>

                                            <span className="blue_text">
                                              {
                                                // Object.keys(
                                                //   TuxedostylesArray["tuxedo_" + i]['tuxedojacket']["groupStyle"][styles]
                                                // ).length > 0
                                                //   ?


                                                TuxedostylesArray[
                                                "tuxedo_" + i
                                                ]['tuxedojacket']["groupStyle"][styles]['value']



                                                // :
                                                // ""
                                              }

                                            </span>

                                          </li>
                                        );
                                      })
                                      : ""}


                                  </ul>
                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"Pant"
                                    ? "Pant".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <ul className="custome_row">
                                    {TuxedostylesArray["tuxedo" + "_" + i] && TuxedostylesArray["tuxedo" + "_" + i]['pant'] && TuxedostylesArray["tuxedo" + "_" + i]['pant']['style']
                                      ? Object.keys(
                                        TuxedostylesArray["tuxedo" + "_" + i]['pant']['style']
                                      ).map((mono) => {
                                        return (
                                          <li className="custome_col_6">
                                            <h5>{mono.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {
                                                TuxedostylesArray[
                                                  "tuxedo" + "_" + i
                                                ]['pant']
                                                  &&
                                                  TuxedostylesArray[
                                                  "tuxedo" + "_" + i
                                                  ]['pant']['style'] &&
                                                  TuxedostylesArray[
                                                    "tuxedo" + "_" + i
                                                  ]['pant']['style'][mono]["value"]
                                                    .length > 0
                                                  ? TuxedostylesArray[
                                                  "tuxedo" + "_" + i
                                                  ]['pant']['style'][mono]["value"]
                                                  : "NA"}
                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                    {TuxedostylesArray["tuxedo_" + i] &&
                                      TuxedostylesArray["tuxedo_" + i]['pant'] &&
                                      TuxedostylesArray["tuxedo_" + i]['pant']["groupStyle"]
                                      ? Object.keys(
                                        TuxedostylesArray["tuxedo_" + i]['pant'][
                                        "groupStyle"
                                        ]
                                      ).map((styles) => {
                                        return (
                                          <li className="custome_col_12">
                                            <h5>{styles.toUpperCase()}</h5>
                                            <span className="blue_text">
                                              {
                                                // Object.keys(
                                                //   TuxedostylesArray["tuxedo_" + i]['pant']["groupStyle"][styles]
                                                // ).length > 0
                                                //   ?


                                                TuxedostylesArray[
                                                "tuxedo_" + i
                                                ]['pant']["groupStyle"][styles]['value']


                                                // :
                                                // ""
                                              }

                                            </span>
                                          </li>
                                        );
                                      })
                                      : ""}
                                  </ul>
                                </div>
                              </div>

                              <div className="fabric_info_card">
                                <h4 className="fic_title">
                                  {"tuxedo"
                                    ? "tuxedo".toUpperCase()
                                    : " "}
                                  <span style={{ marginLeft: "8px" }}>
                                    Styling Note info
                                  </span>
                                </h4>
                                <div className="fi_card_body">
                                  <div className="custome_row">
                                    <div className="custome_col_6 br_0">
                                      <h5> Note </h5>
                                      <span className="blue_text">
                                        {TuxedostylesArray["tuxedo" + "_" + i][
                                          "note"
                                        ]
                                          ? TuxedostylesArray["tuxedo" + "_" + i][
                                          "note"
                                          ]
                                          : "NA"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionDetails>
                  </Accordion>
                </>
              );
            })}
          </>
        ) : (
          <></>
        )}
        <div className="submit_buttonssm">
          <Button onClick={handleSubmit} className="custom-btn">
            Submit
          </Button>
        </div>
      </div>
      {success && (
        <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {success}
          </Alert>
        </Snackbar>
      )}
      {error && (
        <Snackbar
          open={open}
          autoHideDuration={2000}
          onClose={handleClose}
          action={action}
        >
          <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
            {errorMsg}
          </Alert>
        </Snackbar>
      )}
    </main>
  );
}
