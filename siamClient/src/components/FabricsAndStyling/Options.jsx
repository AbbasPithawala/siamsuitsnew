import React, {useEffect} from 'react';
import { PicBaseUrl } from "./../../imageBaseURL";
import SuitStyles from './SuitStyles';
import "./MissingFabric.css"

const styleOptions = {
  display: "flex",
  position: "absolute",
  flexWrap: "wrap",
  zIndex: "1",
  left:  "0"
}


export default function Options({
  styles,
  productIndex,
  styleID,
  setStyleID, 
  featureIndex,
  feature,
  stylesArray,
  setStylesArray,
  product,
  justGroupFeaturesArray,
  setJustGroupFeaturesArray
}
  ){
    useEffect(()=>{ 
      if(stylesArray && stylesArray[product.name + "_" + productIndex] && stylesArray[product.name + "_" + productIndex]['groupStyle']){
        setJustGroupFeaturesArray(Object.keys(stylesArray[product.name + "_" + productIndex]['groupStyle']))
      }
    }, [stylesArray])

// console.log(stylesA)
const handleStyleChange = (event, i) => {
  console.log("event: ", event.target.dataset)
  const itemNameID = product.name + "_" + i;
  if (event.target.dataset.for == "groupStyle") {
    if (stylesArray[itemNameID] && stylesArray[itemNameID]["groupStyle"]) {
      
      if(stylesArray[itemNameID]["groupStyle"][event.target.dataset.feature]){
        let styleInfoObject = {};
        styleInfoObject.value = event.target.value;
        styleInfoObject.image = event.target.dataset.image;
        styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
        styleInfoObject.additional = event.target.dataset.additional;
        styleInfoObject.workerprice = event.target.dataset.workerprice;
        stylesArray[itemNameID]["groupStyle"][event.target.dataset.feature] = styleInfoObject
        // stylesArray[itemNameID]["groupStyle"][event.target.dataset.feature][event.target.dataset.style] = styleInfoObject
        setStylesArray({ ...stylesArray });
        if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
          justGroupFeaturesArray.push(event.target.dataset.feature)
          setJustGroupFeaturesArray([...justGroupFeaturesArray])
        }
      }else{
        let styleInfoObject = {};
        styleInfoObject.value = event.target.value;
        styleInfoObject.image = event.target.dataset.image;
        styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
        styleInfoObject.additional = event.target.dataset.additional;
        styleInfoObject.workerprice = event.target.dataset.workerprice;
        // let object = {}
        // object[event.target.dataset.style] = styleInfoObject
        stylesArray[itemNameID]["groupStyle"][event.target.dataset.feature] = styleInfoObject
        setStylesArray({ ...stylesArray });
        if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
          justGroupFeaturesArray.push(event.target.dataset.feature)
          setJustGroupFeaturesArray([...justGroupFeaturesArray])
        }
      }
    } else {
      const object = {};
      let styleInfoObject = {};
      styleInfoObject.value = event.target.value;
      styleInfoObject.image = event.target.dataset.image;
      styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
      styleInfoObject.additional = event.target.dataset.additional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;

      // object[event.target.dataset.style] = styleInfoObject;
      let parentObject = {}
      parentObject[event.target.dataset.feature] = styleInfoObject
      stylesArray[itemNameID]['groupStyle'] =  parentObject;
      if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
        justGroupFeaturesArray.push(event.target.dataset.feature)
        setJustGroupFeaturesArray([...justGroupFeaturesArray])
      }
      setStylesArray({ ...stylesArray });
    }
  }

};

const handleStyleChangeRadio =(e) =>{
  setStyleID(e.target.dataset.name)
}
console.log("styles array : ", stylesArray)
  return(
    <>
    <div className='Styles frontbutton frontbutton-info' >
    <div className='styleHeading' style={{textTransform: "capitalize"}}>
      <input id={styles['_id']} type="radio" name={feature['_id']} data-name={styles['_id']} onChange={handleStyleChangeRadio}/>
      <label for={styles['_id']}>{styles['name']}</label>
    </div>

    <div className='styleOptions frontbutton-info' style={styleOptions}>
      
      {
        styles['_id'] == styleID
        ?
        styles['image'].length > 0
        ?
        <div style={{display: "flex", flexDirection:"column", alignItems: "center"}}>
        <label for=""><img src={PicBaseUrl + styles['image']} width={100} height={130} alt="" /></label>
        <select 
        name="" 
        data-style={styles.name} 
        data-workerprice= {styles['worker_price'] ? styles['worker_price'] : 0}
        data-for="groupStyle" 
        data-feature={feature.name} 
        data-image={styles['image']}
        data-additional={false} 
        onChange={(e) => handleStyleChange(e, productIndex)}>
          <option value="" selected disabled>Select an option</option>
          
        {styles['style_options'].map((options) => {
            return(
              <option  
              value={options['name']}
              data-set={options['thai_name']}
              selected={
                stylesArray[
                  product.name + "_" + productIndex
                ].groupStyle
                &&
                stylesArray[
                  product.name + "_" + productIndex
                ].groupStyle[feature.name]
                &&
                stylesArray[
                  product.name + "_" + productIndex
                ].groupStyle[feature.name][styles.name]
                &&
                stylesArray[product.name + "_" + productIndex].groupStyle[feature.name][styles.name]["value"]
                ==
                options.name
                ? true
                : false
            }
              >{options['name']}</option>
                
            )
        })}
        </select>
        </div>
        :
        styles['style_options'].map((options) => {
          // console.log("options name: " , options.name)
          // console.log(" value: ",  options.name == stylesArray[product.name + "_" + productIndex].groupStyle[feature.name]["value"])
            return(
              <div className="styleOptions2 frontbutton-info" style={{display: "flex", flexDirection:"column"}}>
                
                <label 
                className={
                  stylesArray[
                    product.name + "_" + productIndex
                  ].groupStyle
                    &&
                    stylesArray[
                      product.name + "_" + productIndex
                    ].groupStyle[feature.name]
                    &&
                    stylesArray[product.name + "_" + productIndex].groupStyle[feature.name]
                    ["value"]
                    ==
                    options.name
                    ? "image-checked-option"
                    : ""
                }

                for={options['_id']}>
                  <img src={PicBaseUrl + options['image']} width={100} height={130} alt="" />
                </label>
                <input 
                checked={
                  stylesArray[
                    product.name + "_" + productIndex
                  ].groupStyle
                    &&
                    stylesArray[
                      product.name + "_" + productIndex
                    ].groupStyle[feature.name]
                    &&
                    stylesArray[product.name + "_" + productIndex].groupStyle[feature.name]
                    ["value"]
                    ==
                    options.name
                    ? true
                    : false
                }
                data-for="groupStyle" 
                data-image={options.image} 
                data-thainame={options['thai_name']} 
                data-additional={false} 
                data-feature={feature.name} 
                data-style={styles.name} 
                data-workerprice= {styles['worker_price'] ? styles['worker_price'] : 0}
                value={options['name']} 
                type="radio" 
                name={styles['_id']} 
                id={options['_id']} 
                style={{ display: "none" }}
                onChange={(e) => handleStyleChange(e, productIndex)}
                // checked={true}
                // checked={
                //   stylesArray[
                //     product.name + "_" + productIndex
                //   ].groupStyle
                //     &&
                //     stylesArray[
                //       product.name + "_" + productIndex
                //     ].groupStyle[feature.name]
                //     &&
                //     stylesArray[product.name + "_" + productIndex].groupStyle[feature.name]
                //     ["value"]
                //     ==
                //     options.name
                //     ? true
                //     : false
                // }
                />
                <span>{options['name']}</span>
              </div>
            )
        })
        :
        <></>
      }
      
    </div>
    </div>
    </>
  )
}