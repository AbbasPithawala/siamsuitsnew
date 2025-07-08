const express = require("express")
const router = express.Router()
const Product = require("./../model/model.products")
const Feature = require("./../model/model.features")
const auth = require("./../../middleware/auth")
const Style = require("./../model/model.styles")


// ============create a Features==================

router.post("/create", auth, async(req, res)=>{
  try{
    const alreadyExists = await Feature.find({name: req.body.feature.name.toLowerCase(), product_id : req.body.feature.product_id})
    if(alreadyExists.length > 0){
      return res.json({
          status: false,
          message: "Feature already exists with this name!",
          data: null
        })
    }

    req.body.feature.name = req.body.feature.name.toLowerCase()

    const feature = new Feature(req.body.feature)

    await feature.save()

    const product = await Product.find({_id: req.body.feature.product_id})
   
    if(product[0].features.length > 0){
       var features_array = product[0].features
       features_array.push(feature._id)
    }else{
      var features_array = [] 
      features_array.push(feature._id)
    }
  
    await Product.findOneAndUpdate({_id: req.body.feature.product_id}, {features: features_array})

    return res.json({
      status: true,
      message: "feature created successfully!",
      data: feature
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});


// ================fetch All Features===================

router.post("/fetchAll/:skip/:limit", auth, async(req, res)=>{
  try{
    const features = await Feature.find().skip(req.params.skip).limit(req.params.limit).populate("styles")
    if(!features.length > 0){
      return res.json({
        status: false,
        message: "No Features found!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Features fetched successfully",
      data: features
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});


// ================fetch a specific feature===================


router.post("/fetch/:id", auth, async(req, res)=>{
  try{
    const feature = await Feature.find({_id: req.params.id}).populate("styles")
    if(!feature.length > 0){
      return res.json({
        status: false,
        message: "No Feature found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Feature fetched successfully",
      data: feature
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});


router.post("/fetchFeatures/:id", auth, async(req, res)=>{
  try{
    const feature = await Feature.find({product_id: req.params.id}).populate("styles");
  
    if(!feature.length > 0){
      return res.json({
        status: false,
        message: "No Feature found with this ID!",
        data: null
      })
    }
    
    return res.json({
      status: true,
      message: "Feature fetched successfully",
      data: feature
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ================Fetch Feature for a Product==================

router.post("/fetchFeature/:id", auth, async(req, res)=>{

  try{

    const features = await Feature.find({product_id: req.params.id}).populate("styles")

    if(!features.length > 0){
      return res.json({
        status: false,
        message: "No Features found for this Product",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Features Fetch for the product successfully",
      data: features
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

})

// ---------------------Edit Product-----------------------

router.put("/update/:id", auth, async(req, res)=>{

  try{

    const featureToBeUpdated = await Feature.find({_id: req.params.id})

    if(!featureToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such Feature found",
        data: null
      })
    }

    const alreadyExists = await Feature.find({name: req.body.feature.name.toLowerCase()})

    if(alreadyExists.length > 0 && featureToBeUpdated[0].name != req.body.feature.name){

      return res.json({
        status: false,
        message: "This Feature name already exists!",
        data: null
      })

    }

    req.body.feature.name = req.body.feature.name.toLowerCase()
    
    const updatedFeature = await Feature.findOneAndUpdate({_id: req.params.id}, req.body.feature)

    return res.json({
      status: true,
      message: "Feature updated successfully",
      data: updatedFeature
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ================delete a specific feature===================


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const feature = await Feature.find({_id: req.params.id})
    if(feature.length > 0 ){
      for(let fea of feature[0].styles){
        await Style.deleteOne({_id: fea.toString()})
       }
    await Feature.deleteOne({_id: req.params.id});
    
    return res.json({
      status: true,
      message: "Feature deleted successfully!",
      data: null
    })

  }else{
    return res.json({
      status: false,
      message: "No Feature found with this ID!",
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


module.exports = router

