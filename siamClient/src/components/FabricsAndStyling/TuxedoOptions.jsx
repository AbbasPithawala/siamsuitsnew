import React, {useEffect} from 'react';
import { PicBaseUrl } from "./../../imageBaseURL";
import ImageUpload from "../../images/ImageUpload.png";

const styleOptions = {
  display: "flex",
  position: "absolute",
  flexWrap: "wrap",
  zIndex: "1",
  left:  "0"
}






export default function TuxedoOptions({
  styles,
  productIndex,
  styleID,
  setStyleID, 
  feature,
  TuxedostylesArray,
  setTuxedostylesArray,
  product,
  justGroupFeaturesArray,
  setJustGroupFeaturesArray
}
  ){

    useEffect(()=>{
      if(TuxedostylesArray && TuxedostylesArray["tuxedo_" + productIndex] && TuxedostylesArray["tuxedo_" + productIndex][product] && TuxedostylesArray["tuxedo_" + productIndex][product]['groupStyle']){
        setJustGroupFeaturesArray(Object.keys(TuxedostylesArray["tuxedo_" + productIndex][product]['groupStyle']))
      }
    }, [TuxedostylesArray])

    


const handleSuitStyleChange = (event, i, suitPro) => {
  let itemNameID = "tuxedo" + "_" + i;
if (event.target.dataset.for == "groupStyle") {
    if (TuxedostylesArray[itemNameID][suitPro]["groupStyle"]) {
      if(TuxedostylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature]){
        let styleInfoObject = {};
        styleInfoObject.value = event.target.value;
        styleInfoObject.image = event.target.dataset.image;
        styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
        styleInfoObject.additional = event.target.dataset.addtional;
        styleInfoObject.workerprice = event.target.dataset.workerprice;
        styleInfoObject.process = event.target.dataset.process;
        TuxedostylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature]= styleInfoObject
        setTuxedostylesArray({ ...TuxedostylesArray });
        if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
          justGroupFeaturesArray.push(event.target.dataset.feature)
          setJustGroupFeaturesArray([...justGroupFeaturesArray])
        }
      }
      else{
        let styleInfoObject = {};
        styleInfoObject.value = event.target.value;
        styleInfoObject.image = event.target.dataset.image;
        styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
        styleInfoObject.additional = event.target.dataset.addtional;
        styleInfoObject.workerprice = event.target.dataset.workerprice;
        styleInfoObject.process = event.target.dataset.process;
        // let object = {}
        // object[event.target.dataset.style] = styleInfoObject
        TuxedostylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature] = styleInfoObject
        setTuxedostylesArray({ ...TuxedostylesArray });
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
      styleInfoObject.additional = event.target.dataset.addtional;
      styleInfoObject.workerprice = event.target.dataset.workerprice;
      styleInfoObject.process = event.target.dataset.process;
      let parentObject = {}
      parentObject[event.target.dataset.feature] = styleInfoObject
      TuxedostylesArray[itemNameID][suitPro]['groupStyle'] = parentObject;
      if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
        justGroupFeaturesArray.push(event.target.dataset.feature)
        setJustGroupFeaturesArray([...justGroupFeaturesArray])
      }
      setTuxedostylesArray({ ...TuxedostylesArray });
    }
  }
};



const handleStyleChangeRadio =(e) =>{
  setStyleID(e.target.dataset.name)
}

  return(
    <>
    <div className='Styles'>
    <div className='styleHeading' style={{textTransform: "capitalize"}}>
      <input id={styles['_id']} type="radio" name={feature['_id']} data-name={styles['_id']} checked={styles['_id'] === styleID} onChange={handleStyleChangeRadio}/>
      <label for={styles['_id']}>{styles['name']}</label>
    </div>
    <div className='styleOptions' style={styleOptions}>
      
      {
        styles['_id'] == styleID
        ?
        // New logic: Check if ANY option has an image first
        styles['style_options'].some(option => option.image && option.image.length > 0)
        ?
        // If options have images, show them as individual image choices
        styles['style_options'].map((options) => {
            return(
              <div className="styleOptions2" style={{display: "flex", flexDirection:"column", marginLeft: "15px", border:"solid 1px #e1e1e1", borderRadius: "5px", padding: "5px"}}>

                <label for={options['_id']}>
                  <img src={
                    // Priority: 1) Option image, 2) Main style image as fallback
                    options['image'] && options['image'].length > 0
                    ? PicBaseUrl + options['image']
                    : styles['image'] && styles['image'].length > 0
                    ? PicBaseUrl + styles['image']
                    : ImageUpload
                  } width={100} height={130} alt="" />
                </label>
                <input 
                data-for="groupStyle" 
                data-image={options.image} 
                data-thainame={options['name']} 
                data-addtional={false} 
                data-feature={feature.name} 
                data-workerprice = {styles['worker_price'] ? styles['worker_price'] : 0}
                data-process={feature.process}
                data-style={styles.name} 
                value={options['name']} 
                type="radio" 
                name={styles['_id']} 
                id={options['_id']} 
                style={{ display: "none" }}
                onChange={(e) => handleSuitStyleChange(e, productIndex)}
                checked={
                  TuxedostylesArray[
                    "tuxedo_" + productIndex
                    ][product]
                      &&
                      TuxedostylesArray[
                  "tuxedo_" + productIndex
                  ][product].groupStyle
                    &&
                    TuxedostylesArray[
                    "tuxedo_" + productIndex
                    ][product].groupStyle[feature.name]
                    &&
                    TuxedostylesArray[
                    "tuxedo_" + productIndex
                    ][product].groupStyle[feature.name][styles.name]
                    &&
                    TuxedostylesArray["tuxedo" + productIndex][product].groupStyle[feature.name][styles.name]["value"]
                    ==
                    options.name
                    ? true
                    : false
                }/><span>{options['name']}</span>
              </div>
            )
        })
        :
        // If no options have images, check if main style has image for dropdown mode
        styles['image'] && styles['image'].length > 0
        ?
        <div style={{display: "flex", flexDirection:"column", alignItems: "center"}}>
        <label for=""><img src={PicBaseUrl + styles['image']} width={100} height={130} alt="" /></label>
        <select 
        name="" 
        data-style={styles.name} 
        id="" 
        data-for="groupStyle" 
        data-feature={feature.name}
        data-workerprice = {styles['worker_price'] ? styles['worker_price'] : 0}
        data-image={styles['image']}
        data-addtional={false}
        data-process={feature.process} 
        onChange={(e) => handleSuitStyleChange(e, productIndex, product)}>
          
          <option value="" selected disabled>Select an option</option>
          
        {styles['style_options'].map((options) => {
            return(
              <option  
              value={options['name']}
              data-set={options['thai_name']}
              selected={
                TuxedostylesArray[
                  "tuxedo_" + productIndex
                ][product]
                &&
                TuxedostylesArray[
                  "tuxedo_" + productIndex
                ][product].groupStyle
                &&
                TuxedostylesArray[
                  "tuxedo_" + productIndex
                ][product].groupStyle[feature.name]
                &&
                TuxedostylesArray[
                  "tuxedo_" + productIndex
                ][product].groupStyle[feature.name][styles.name]
                &&
                TuxedostylesArray["tuxedo_" + productIndex][product].groupStyle[feature.name][styles.name]["value"]
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
        // If neither options nor main style have images, show text-only options
        styles['style_options'].map((options) => {
          return(
            <div className="styleOptions2" style={{display: "flex", flexDirection:"column", marginLeft: "15px", border:"solid 1px #e1e1e1", borderRadius: "5px", padding: "5px"}}>
              <input 
              data-for="groupStyle" 
              data-image={options.image} 
              data-thainame={options['name']} 
              data-addtional={false} 
              data-feature={feature.name} 
              data-workerprice = {styles['worker_price'] ? styles['worker_price'] : 0}
              data-process={feature.process}
              data-style={styles.name} 
              value={options['name']} 
              type="radio" 
              name={styles['_id']} 
              id={options['_id']} 
              onChange={(e) => handleSuitStyleChange(e, productIndex, product)}
              checked={
                TuxedostylesArray[
                  "tuxedo_" + productIndex
                  ][product]
                    &&
                    TuxedostylesArray[
                "tuxedo_" + productIndex
                ][product].groupStyle
                  &&
                  TuxedostylesArray[
                  "tuxedo_" + productIndex
                  ][product].groupStyle[feature.name]
                  &&
                  TuxedostylesArray[
                  "tuxedo_" + productIndex
                  ][product].groupStyle[feature.name][styles.name]
                  &&
                  TuxedostylesArray["tuxedo_" + productIndex][product].groupStyle[feature.name][styles.name]["value"]
                  ==
                  options.name
                  ? true
                  : false
              }/>
              <label for={options['_id']}>
                <span>{options['name']}</span>
              </label>
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