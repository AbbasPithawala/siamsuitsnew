import React, {useEffect} from 'react';
import { PicBaseUrl } from "./../../imageBaseURL";

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
      <input id={styles['_id']} type="radio" name={feature['_id']} data-name={styles['_id']} onChange={handleStyleChangeRadio}/>
      <label for={styles['_id']}>{styles['name']}</label>
    </div>
    <div className='styleOptions' style={styleOptions}>
      
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
        id="" 
        data-for="groupStyle" 
        data-feature={feature.name}
        data-workerprice = {styles['worker_price'] ? styles['worker_price'] : 0}
        data-image={styles['image']}
        data-addtional={false} 
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
        styles['style_options'].map((options) => {
            return(
              <div className="styleOptions2" style={{display: "flex", flexDirection:"column", marginLeft: "15px", border:"solid 1px #e1e1e1", borderRadius: "5px", padding: "5px"}}>

                <label for={options['_id']}><img src={PicBaseUrl + options['image']} width={100} height={130} alt="" /></label>
                <input 
                data-for="groupStyle" 
                data-image={options.image} 
                data-thainame={options['name']} 
                data-addtional={false} 
                data-feature={feature.name} 
                data-workerprice = {styles['worker_price'] ? styles['worker_price'] : 0}
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
        <></>
      }
      
    </div>
    </div>
    </>
  )
}