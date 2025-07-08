import React, {useEffect} from 'react';
import { PicBaseUrl } from "./../../imageBaseURL";

const styleOptions = {
  display: "flex",
  position: "absolute",
  flexWrap: "wrap",
  zIndex: "1",
  left:  "0"
}






export default function SuitOptions({
  styles,
  productIndex,
  styleID,
  setStyleID, 
  feature,
  SuitstylesArray,
  setSuitstylesArray,
  product,
  justGroupFeaturesArray,
  setJustGroupFeaturesArray
}
  ){

    useEffect(()=>{
      if(SuitstylesArray && SuitstylesArray["suit_" + productIndex] && SuitstylesArray["suit_" + productIndex][product] && SuitstylesArray["suit_" + productIndex][product]['groupStyle']){
        setJustGroupFeaturesArray(Object.keys(SuitstylesArray["suit_" + productIndex][product]['groupStyle']))
      }
    }, [SuitstylesArray])

    


const handleSuitStyleChange = (event, i, suitPro) => {
  let itemNameID = "suit" + "_" + i;
if (event.target.dataset.for == "groupStyle") {
    if (SuitstylesArray[itemNameID][suitPro]["groupStyle"]) {
      if(SuitstylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature]){
        let styleInfoObject = {};
        styleInfoObject.value = event.target.value;
        styleInfoObject.image = event.target.dataset.image;
        styleInfoObject.thai_name = event.target.dataset.thainame || event.target.selectedOptions[0].getAttribute('data-set');
        styleInfoObject.additional = event.target.dataset.addtional;
        styleInfoObject.workerprice = event.target.dataset.workerprice;
        SuitstylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature]= styleInfoObject
        setSuitstylesArray({ ...SuitstylesArray });
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
        SuitstylesArray[itemNameID][suitPro]["groupStyle"][event.target.dataset.feature] = styleInfoObject
        setSuitstylesArray({ ...SuitstylesArray });
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
      SuitstylesArray[itemNameID][suitPro]['groupStyle'] = parentObject;
      if(!justGroupFeaturesArray.includes(event.target.dataset.feature)){
        justGroupFeaturesArray.push(event.target.dataset.feature)
        setJustGroupFeaturesArray([...justGroupFeaturesArray])
      }
      setSuitstylesArray({ ...SuitstylesArray });
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
                SuitstylesArray[
                  "suit_" + productIndex
                ][product]
                &&
                SuitstylesArray[
                  "suit_" + productIndex
                ][product].groupStyle
                &&
                SuitstylesArray[
                  "suit_" + productIndex
                ][product].groupStyle[feature.name]
                &&
                SuitstylesArray[
                  "suit_" + productIndex
                ][product].groupStyle[feature.name][styles.name]
                &&
                SuitstylesArray["suit_" + productIndex][product].groupStyle[feature.name][styles.name]["value"]
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
                  SuitstylesArray[
                    "suit_" + productIndex
                    ][product]
                      &&
                      SuitstylesArray[
                  "suit_" + productIndex
                  ][product].groupStyle
                    &&
                    SuitstylesArray[
                    "suit_" + productIndex
                    ][product].groupStyle[feature.name]
                    &&
                    SuitstylesArray[
                    "suit_" + productIndex
                    ][product].groupStyle[feature.name][styles.name]
                    &&
                    SuitstylesArray["suit" + productIndex][product].groupStyle[feature.name][styles.name]["value"]
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