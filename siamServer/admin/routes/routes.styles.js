const express = require("express")
const router = express.Router()
const Style = require("./../model/model.styles")
const Feature = require("./../model/model.features")
const auth = require("./../../middleware/auth")


// ============create a style==================

router.post("/create", auth, async(req, res)=>{
  try{
console.log(req.body)
    for (let x of req.body.style){
      const alreadyExists = await Style.find({name: x.name.toLowerCase(), feature_id: x.feature_id})
      console.log(alreadyExists)
    if(alreadyExists.length > 0){
      return res.json({
          status: false,
          message: "Style already exists with this name!",
          data: null
        })
    }

    x.name = x.name.toLowerCase()

    const style = new Style(x)

    await style.save()

    const feature = await Feature.find({_id: x.feature_id})
   
    if(feature[0].styles.length > 0){
       var styles_array = feature[0].styles
       styles_array.push(style._id)
    }else{
      var styles_array = []
      styles_array.push(style._id)
    }
  
    await Feature.findOneAndUpdate({_id: x.feature_id}, {styles: styles_array})
  }
    return res.json({
      status: true,
      message: "styles created successfully!",
      data: req.body.style
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ================fetch All Styles===================


router.post("/fetchAll/:skip/:limit", auth, async(req, res)=>{
  try{
    const styles = await Style.find().skip(req.params.skip).limit(req.params.limit)
    if(!styles.length > 0){
      return res.json({
        status: false,
        message: "No Styles found!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Styles fetched successfully",
      data: styles
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ================fetch a specific style===================


router.post("/fetch/:id", auth, async(req, res)=>{
  try{
    const style = await Style.find({_id: req.params.id})
    if(!style.length > 0){
      return res.json({
        status: false,
        message: "No Style found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Style fetched successfully",
      data: style
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ================Fetch Style for a feature==================

router.post("/fetchStyle/:id", auth, async(req, res)=>{
  try{
    const styles = await Style.find({feature_id: req.params.id})
    if(!styles.length > 0){
      return res.json({
        status: false,
        message: "No Styles found for this feature",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Styles Fetch for the feature successfully",
      data: styles
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ---------------------Edit Style-----------------------

router.put("/update/:id", auth, async(req, res)=>{

  try{

    console.log(req.body)

    const styleToBeUpdated = await Style.find({_id: req.params.id})

    if(!styleToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such Style found",
        data: null
      })
    }

    const alreadyExists = await Style.find({name: req.body.style.name.toLowerCase()})

    if(alreadyExists.length > 0 && styleToBeUpdated[0].name != req.body.style.name){

      return res.json({
        status: false,
        message: "This Style name already exists!",
        data: null
      })

    }
    req.body.style.name = req.body.style.name.toLowerCase()
    const updatedStyle = await Style.findOneAndUpdate({_id: req.params.id}, req.body.style)

    return res.json({
      status: true,
      message: "Style updated successfully",
      data: updatedStyle
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})


// ================delete a specific style===================


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const style = await Style.find({_id: req.params.id})
    if(style.length > 0 ){
      
    await Style.deleteOne({_id: req.params.id});
    
    return res.json({
      status: true,
      message: "Style deleted successfully!",
      data: null
    })
  }else{
    return res.json({
      status: false,
      message: "No style found with this ID!",
      data: null
    })
  }
    
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }

})


// Style Options APIS

// ---------------------Edit Options-----------------------

router.put("/updateOptions/:id", auth, async(req, res)=>{
  try{

    console.log(req.params.id)
    const styleToBeUpdated = await Style.findById(req.params.id)

    if(!styleToBeUpdated){
      return res.json({
        status: false,
        message: "No such Style found",
        data: null
      })
    }

    styleToBeUpdated['style_options'] = req.body.styleOptions

    await styleToBeUpdated.save()
    return res.json({
      status: true,
      message: "Style Options updated successfully",
      data: req.body.styleOptions
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})


// -------------------update Options------------------------

router.put("/updateSingleOption/:id", auth, async(req, res)=>{

  try{

    const styleToBeUpdated = await Style.findById(req.params.id)

    if(!styleToBeUpdated){
      return res.json({
        status: false,
        message: "No such Style found",
        data: null
      })
    }

    req.body.option['name'] = req.body.option['name'].toLowerCase()
  
    for(let x of styleToBeUpdated['style_options']){
      if(x._id == req.body.option._id){
        x.thai_name = req.body.option['thai_name']
        x.name = req.body.option['name']
        x.image = req.body.option['image']
      }

    }
    await styleToBeUpdated.save()

    return res.json({
      status: true,
      message: "Style Options updated successfully",
      data: styleToBeUpdated
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ------------------addnew Option--------------------------


router.put("/addSingleOption/:id", auth, async(req, res)=>{

  try{


    const styleToBeUpdated = await Style.findById(req.params.id)

    if(!styleToBeUpdated){
      return res.json({
        status: false,
        message: "No such Style found",
        data: null
      })
    }

   

    req.body.option['name'] = req.body.option['name'].toLowerCase()
    styleToBeUpdated['style_options'].push(req.body.option)
    
    await styleToBeUpdated.save()
    // const updatedStyle = await Style.findOneAndUpdate({_id: req.params.id}, {style_options: req.body.style_options})

    return res.json({
      status: true,
      message: "Style Options updated successfully",
      data: styleToBeUpdated
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})


// -----------------delete an option------------------------

// router.put("/deleteSingleOption/:id", auth, async(req, res)=>{

//   try{


//     const styleToBeDeleted = await Style.findById(req.params.id)

//     if(!styleToBeDeleted){
//       return res.json({
//         status: false,
//         message: "No such Style found",
//         data: null
//       })
//     }

   

//     req.body.option['name'] = req.body.option['name'].toLowerCase()
//     for(let x of styleToBeUpdated['style_options']){
//       console.log(x)
//       console.log(req.body.option)
//       if(x._id == req.body.option._id){
//         // console.log(x)
//         x.name = req.body.option['name']
//         x.image = req.body.option['image']
//       }

//     }
//     console.log(styleToBeUpdated['style_options'])
//     await styleToBeUpdated.save()
//     // const updatedStyle = await Style.findOneAndUpdate({_id: req.params.id}, {style_options: req.body.style_options})

//     return res.json({
//       status: true,
//       message: "Style Options updated successfully",
//       data: styleToBeUpdated
//     })

//   }catch(err){
    
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
    
//   }
// })



module.exports = router