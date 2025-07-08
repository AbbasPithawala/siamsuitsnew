const express = require("express");
const router = express.Router();
const ExtraPayments = require("./../../model/factoryModel/model.extraPayments");
const ExtraPaymentCategories = require("./../../model/factoryModel/model.extraPaymentCategories")
const Tailor = require("./../../model/factoryModel/model.tailor")
const Product = require("./../../model/model.products")
const auth = require("./../../../middleware/auth");
const APIFeatures = require("../../../utills/apiFeatures");
const catchAsync = require('./../../../utills/catchAsync');
const AppError = require('../../../utills/appError');
const mongoose = require("mongoose");


router.post("/create", auth, catchAsync(async (req, res, next) => {

    try{

        const product = await Product.find({_id: req.body.extraPayment.product})
        if(!product.length > 0){
            return res.json({
                status: false,
                message: "No Product found by this ID!",
                data: null
            });
        }
        const extraPaymentCategories = await ExtraPaymentCategories.find({_id: req.body.extraPayment.extraPaymentCategory})
        
        if(!extraPaymentCategories.length > 0){
            return res.json({
                status: false,
                message: "No Category found by this ID!",
                data: null
            });
        }

        if(extraPaymentCategories[0]['product'] !== req.body.extraPayment.product){
            return res.json({
                status: false,
                message: "Products and extra categories do not match!",
                data: null
            });
        }

        const alreadyExist = await ExtraPayments.find({order_id: req.body.extraPayment.order_id, item_code: req.body.extraPayment.item_code, extraPaymentCategory: req.body.extraPayment.extraPaymentCategory})
        console.log(req.body)
        console.log(alreadyExist)
        if(alreadyExist.length > 0 ){
          return res.json({
            status: false,
            message: "Payment for this has already been created.!",
            data: null
        });
        }


        const extraPayment  = new ExtraPayments(req.body.extraPayment)

        await extraPayment.save()


        return res.json({
            status: true,
            message: "Worker Extra Payment category created successfully!",
            data: extraPayment
        });
        
    }catch(err){

        return res.json({
            status: false,
            message: err.message,
            data: null
        });
    }    

}));

// router.post("/fetchAll/:id", auth, catchAsync(async (req, res, next) => {

//     try{

//         const workerAdvancePayment = await WorkerAdvancePayment.find({worker: req.params.id}).populate("worker");
//         // const tailers = await Tailor.find();
        
//         if(workerAdvancePayment.length > 0){
//           return res.json({
//             status: true,
//             message: "Advance Payment fetched successfully !.",
//             data: workerAdvancePayment
//           })
//         }else{
//           return res.json({
//             status: false,
//             message: "No Advance Payment found !.",
//             data: []
//           })
//         }
    
//       }catch(err){
//         return res.json({
//           status: false,
//           message: err.message,
//           data: []
//         })
//       }

// }));


router.put("/update/:id", auth, async(req, res) => {
  try{ 

    const extraPayment = await ExtraPayments.find({_id : req.params.id});
    
    if(extraPayment.length < 1){
      return res.json({
        status: false,
        message: "No Extra Payment found with this ID!.",
        data: null
      })
    }

    const updatedExtraPayment = await ExtraPayments.findOneAndUpdate({_id: req.params.id}, req.body.extraPayment)

    return res.json({
      status: true,
      message: "Extra Payment updated successfully !.",
      data: updatedExtraPayment
    })

  }catch(err){
    console.log(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

// fetch unapproved worker extra payments====================================

router.post('/fetchAll', auth, async(req, res) => {
  try{
    const extraPayments = await ExtraPayments.find(req.body.filter).populate("tailor").populate("order_id").populate('group_order_id').populate('product').populate('extraPaymentCategory')
    if(!extraPayments.length > 0){
      return res.json({
        status: false,
        message: "No Extra Payment Found for this Worker!.",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Extra Payments Fetched successfully!.",
      data: extraPayments
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// router.post("/delete/:id", auth, catchAsync(async (req, res, next) => {

//   try{

//       const extraPaymentCategories = await ExtraPaymentCategories.find({_id: req.params.id})
//       if(extraPaymentCategories.length > 0 ){
        
//       await ExtraPaymentCategories.deleteOne({_id: req.params.id});

//       const extraPaymentCategoriesUpdate = await ExtraPaymentCategories.find().populate("product").populate("feature").populate("style");
      
//       return res.json({
//         status: true,
//         message: "Extra Payment Category deleted successfully!",
//         data: extraPaymentCategoriesUpdate
//       })
//     }else{
//       return res.json({
//         status: false,
//         message: "No Extra Payment Category found with this ID!",
//         data: null
//       })
//     }
      
//     }catch(err){
//       return res.json({
//         status: false,
//         message: err.message,
//         data: null
//       })
      
//     }
// }));

// router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {
//     try{

//         const tailer = await Tailor.find({_id : req.params.id});
        
//         if(tailer.length > 0){
//           return res.json({
//             status: true,
//             message: "Tailer fetched successfully !.",
//             data: tailer
//           })
//         }else{
//           return res.json({
//             status: false,
//             message: "No Tailer found with this ID!.",
//             data: null
//           })
//         }
    
//       }catch(err){
//         return res.json({
//           status: false,
//           message: err.message,
//           data: null
//         })
//       }
// }));

// router.put("/update/:id", auth, catchAsync(async (req, res, next) => {

//     try{

//         const tailer = await Tailor.find({_id : req.params.id});
        
//         if(tailer.length < 1){
//           return res.json({
//             status: false,
//             message: "No Tailer found with this ID!.",
//             data: null
//           })
//         }
//         const alreadyExists = await Tailor.find({username: req.body.tailer.username.toLowerCase()})
    
//         if(alreadyExists.length > 0 && tailer[0].username != req.body.tailer.username){
    
//           return res.json({
//             status: false,
//             message: "This Tailer username already exists!",
//             data: null
//           })
    
//         }
    
//         req.body.tailer.username = req.body.tailer.username.toLowerCase()
    
//         const updatedTailer = await Tailor.findOneAndUpdate({_id: req.params.id}, req.body.tailer)
    
//         return res.json({
//           status: true,
//           message: "Tailer updated successfully !.",
//           data: updatedTailer
//         })
    
//       }catch(err){
//         console.log(err)
//         return res.json({
//           status: false,
//           message: err.message,
//           data: null
//         })
//       }

// }));

// router.post("/delete/:id", auth, catchAsync(async (req, res, next) => {

//     try{

//         const tailer = await Tailor.find({_id: req.params.id})
//         if(tailer.length > 0 ){
          
//         await Tailor.deleteOne({_id: req.params.id});
        
//         return res.json({
//           status: true,
//           message: "Tailer deleted successfully!",
//           data: null
//         })
//       }else{
//         return res.json({
//           status: false,
//           message: "No Tailer found with this ID!",
//           data: null
//         })
//       }
        
//       }catch(err){
//         return res.json({
//           status: false,
//           message: err.message,
//           data: null
//         })
        
//       }
// }));


module.exports = router