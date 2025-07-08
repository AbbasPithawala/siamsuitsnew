const express = require("express")
const router = express.Router()
const Product = require("./../model/model.products")
const Retailer = require("./../model/model.retailer")
const Fittings = require("./../model/model.customFittings")
const auth = require("./../../middleware/auth")


// ============create a custom fitting==================


router.post("/create", auth, async(req, res)=>{

  try{

    const alreadyExists = await Fittings.findOne({

      product_id: req.body.fitting.product_id, 
      fitting_name: req.body.fitting.fitting_name

    })
 
    if(alreadyExists != null){

      // alreadyExists.measurements =  req.body.fitting.measurements

      // await alreadyExists.save()

      return res.json({
        status: false,
        message: "fitting already exists in this product!",
        data: null
      })
    }

    const newFittings = new Fittings(req.body.fitting)

    await newFittings.save()

    return res.json({
      status: true,
      message: "fitting created successfully!",
      data: newFittings
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})


// ================fetch fittings for a product and a retailer===========================

router.post("/fetch/:product", auth, async(req, res)=>{

  try{

    const fittings = await Fittings.find({product_id: req.params.product})
    
    if(!fittings.length > 0){
      return res.json({
        status: false,
        message: "No fittings found for this product",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Fittings fetched successfully",
      data: fittings
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

// ================fetch a single fitting===========================

router.post("/fetchFitting/:fitting", auth, async(req, res)=>{

  try{

    const fittings = await Fittings.find({_id: req.params.fitting})
    
    if(!fittings.length > 0){
      return res.json({
        status: false,
        message: "No fittings found",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Fittings fetched successfully",
      data: fittings
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})


// ================fetch fittings for a product and a retailer===========================

router.post("/fetchAll", auth, async(req, res)=>{

  try{

    const fittings = await Fittings.find()
    
    if(!fittings.length > 0){
      return res.json({
        status: false,
        message: "No fittings found",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Fittings fetched successfully",
      data: fittings
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})


// ================fetch fittings general===========================

// router.post("/fetchGeneral", auth, async(req, res)=>{

//   try{

//     const fittings = await Fittings.find({fitting_general: true})
    
//     if(!fittings.length > 0){
//       return res.json({
//         status: false,
//         message: "No fittings found!",
//         data: null
//       })
//     }
//     return res.json({
//       status: true,
//       message: "Fittings fetched successfully",
//       data: fittings
//     })

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }

// })



// router.put("/update", auth, async(req, res)=>{
//   try{

//     const fittings = await Fittings.find({product_id: req.body.fitting.product_id}) 

//     for(let x of fittings){
//       for(let y of req.body.fitting){
//         if(x.fitting_name == y.fitting_name){
//           x.measurements = y.measurements
//         }
//       }
//       await x.save()
//     }    

//     return res.json({
//       status: true,
//       message: "Fittings updated successfully",
//       data: req.body.fitting
//     })

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })





router.post("/delete/:id", auth, async(req, res)=>{
  try{
    const data = await Fittings.find({_id: req.params.id})
   
    if(!data.length > 0){
      res.json({
        status: false,
        message: "No data found for this ID !",
        data: null
      })
    }
    
    await Fittings.findByIdAndDelete({_id: req.params.id})
    
    res.json({
      status: true,
      message: "fitting Deleted successfully",
    })

  }catch(err){

    res.json({
      status: false,
      message: err.message,
      data: null
    })

  }
})


// ===============Edit a custom fitting=====================

router.put("/updateMeasurementFits/:id", auth, async(req, res)=>{

  try{

    const data = await Fittings.findById({_id:req.params.id});
    // console.log(req.body.fitting[0].measurements)
    if(!data){
      return res.json({
        status: false,
        message: "No such product found",
        data: null
      })
    }

    data.fitting_name = req.body.fitting[0].fitting_name;

    data.measurements = req.body.fitting[0].measurements;
    
    await data.save();

    return res.json({
      status: true,
      message: "Product updated successfully",
      data: data
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
});
// ===========================================================
// ==================== exporting modules ====================
// ===========================================================
module.exports = router