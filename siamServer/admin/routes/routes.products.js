const express = require("express")
const router = express.Router()
const Product = require("./../model/model.products")
const auth = require("./../../middleware/auth")
const { resolve } = require("path")
const Feature = require("../model/model.features")
const Process = require("./../model/model.ProductProcess")


// ============create a product==================

router.post("/create", auth, async(req, res)=>{

  try{
    const alreadyExists = await Product.find({name: req.body.product.name.toLowerCase()})

    if(alreadyExists.length > 0){
      return res.json({
          status: false,
          message: "Product already exists with this name!",
          data: null
        })
    }

    req.body.product.name = req.body.product.name.toLowerCase()

    const product = new Product(req.body.product)
    await product.save()
    return res.json({
      status: true,
      message: "product created successfully!",
      data: product
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

// ================fetch All products===================

router.post("/fetchAll/:skip/:limit", auth, async(req, res)=>{
  try{
    const products = await Product.find().skip(req.params.skip).limit(req.params.limit).populate("features measurements")
    if(products.length < 0){
      return res.json({
        status: false,
        message: "No Products found!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Products fetched successfully",
      data: products
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ================fetch a specific product===================

router.post("/fetch/:id", auth, async(req, res)=>{
  try{
    const product = await Product.find({_id: req.params.id}).populate('features')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ================fetch a specific product for retialer end with measurements===================

router.post("/fetchForMeasurements/:id", auth, async(req, res)=>{
  try{
    const product = await Product.find({_id: req.params.id}).populate('measurements')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: []
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});

// ======================================================================

router.post("/fetchForMeasurementsForSuit/:name", auth, async(req, res)=>{
  try{
    const product = await Product.find({name: req.params.name}).populate('measurements')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ======================================================================
// ---
router.post("/fetchForMeasurementsForTuxedo/:name", auth, async(req, res)=>{
  try{
    const product = await Product.find({name: req.params.name}).populate('measurements')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ===================delete a specific product===================

// ======================================================================

router.post("/fetchForMeasurementForTuxedo/:name", auth, async(req, res)=>{

  try{
    const product = await Product.find({name: JSON.parse(JSON.stringify(req.params.name))}).populate('measurements')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ===================delete a specific product===================

router.post("/delete/:id", auth, async(req, res)=>{

  try{

    const product = await Product.find({_id: req.params.id})

    if(product.length > 0){
      for(let fea of product[0].features){
        await Feature.deleteOne({_id: fea.toString()})

      }

    await Product.deleteOne({_id: req.params.id});

    return res.json({
      status: true,
      message: "product deleted successfully!",
      data: null
    })

  }else{
    return res.json({
      status: false,
      message: "No product found with this ID!",
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

// ---------------------Edit Product-----------------------

router.put("/update/:id", auth, async(req, res)=>{

  try{

    const productToBeUpdated = await Product.find({_id: req.params.id})

    if(!productToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such product found",
        data: null
      })
    }

    const alreadyExists = await Product.find({name: req.body.product.name.toLowerCase()})

    if(alreadyExists.length > 0 && productToBeUpdated[0].name != req.body.product.name){

      return res.json({
        status: false,
        message: "This product name already exists!",
        data: null
      })

    }

    req.body.product.name = req.body.product.name.toLowerCase()
    const updatedProduct = await Product.findOneAndUpdate({_id: req.params.id}, req.body.product)

    return res.json({
      status: true,
      message: "Product updated successfully",
      data: updatedProduct
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ---------------------Edit Product Measurement-----------------------

router.put("/updateMeasurements/:id", auth, async(req, res)=>{

  try{

    const productToBeUpdated = await Product.find({name: req.params.id})

    if(!productToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such product found",
        data: null
      })
    }
    const updatedProduct = await Product.findOneAndUpdate({name: req.params.id}, {measurements: req.body.measurements},{new:true})

    return res.json({
      status: true,
      message: "Measurement Steps updated successfully",
      data: updatedProduct
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ---------------------Edit Product Feature-----------------------

router.put("/updateFeatures/:id", auth, async(req, res)=>{

  try{

    const productToBeUpdated = await Product.find({name: req.params.id})

    if(!productToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such product found",
        data: null
      })
    }
    const updatedProduct = await Product.findOneAndUpdate({name: req.params.id}, {features: req.body.features},{new:true})

    return res.json({
      status: true,
      message: "Features steps updated successfully",
      data: updatedProduct
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ---------------------fetch product with name-------------------------

router.post("/fetchByName/:id", auth, async(req, res)=>{
  try{
    const product = await Product.find({name: req.params.id}).populate('features')
    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// create a process ====================================================

router.post("/createProcess", auth, async(req, res) => {

  try{
    const alreadyExists = await Process.find({name: req.body.process.name.toLowerCase()})

    if(alreadyExists.length > 0){
      return res.json({
          status: false,
          message: "Process already exists with this name!",
          data: null
        })
    }

    req.body.process.name = req.body.process.name.toLowerCase()

    const process = new Process(req.body.process)
    await process.save()
    return res.json({
      status: true,
      message: "process created successfully!",
      data: process
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// Edit a process ====================================================

router.post("/editProcess/:id", auth, async(req, res) => {

  try{
    const thisProcess = await Process.find({_id: req.params.id})
    if(!thisProcess.length > 0){
      return res.json({
          status: false,
          message: "No Process exists with this name!",
          data: null
        })
    }
    const alreadyExists = await Process.find({name: req.body.process.name.toLowerCase()})


    if(alreadyExists.length > 0 && alreadyExists[0]['_id'] != req.params.id){
      return res.json({
          status: false,
          message: "Process already exists with this name!",
          data: null
        })
    }

    req.body.process.name = req.body.process.name.toLowerCase()

    await Process.findByIdAndUpdate(req.params.id, req.body.process)
    return res.json({
      status: true,
      message: "process updated successfully!",
      data: null
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// fetch processes-----------------------------------------------------

router.post("/fetchProcess", auth, async(req, res) =>{
  try{
    const processes = await Process.find()
    if(processes.length < 0){
      return res.json({
        status: false,
        message: "No Processes found!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Processes fetched successfully",
      data: processes
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

router.post("/fetchByJacketName/:name", auth, async(req, res)=>{
  try{
    const product = await Product.find({name: req.params.name})
    .populate({
      path: 'features',
      populate: {
          path: 'styles', 
          model: 'Style'
      }
  });

    if(!product.length > 0){
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Product fetched successfully",
      data: product
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: []
    })
  }
});

module.exports = router

