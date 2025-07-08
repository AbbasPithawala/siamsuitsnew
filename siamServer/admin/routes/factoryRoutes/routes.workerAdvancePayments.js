const express = require("express");
const router = express.Router();
const WorkerAdvancePayment = require("./../../model/factoryModel/model.workerAdvancePayments");
const Tailor = require("./../../model/factoryModel/model.tailor")
const auth = require("./../../../middleware/auth");
const APIFeatures = require("../../../utills/apiFeatures");
const catchAsync = require('../../../utills/catchAsync');
const AppError = require('../../../utills/appError');
const mongoose = require("mongoose");


router.post("/create", auth, catchAsync(async (req, res, next) => {

    try{

        const workerAdvancePayment = await WorkerAdvancePayment.create(req.body.workerAdvancePayment);
        const worker =  await Tailor.findOne({_id: req.body.workerAdvancePayment.worker})
        const advancePayment = Number(worker['advancePayment']) + Number(req.body.workerAdvancePayment.amount)
        const updateWorker = await Tailor.findOneAndUpdate({_id: req.body.workerAdvancePayment.worker}, {advancePayment: advancePayment})
        
  
        return res.json({
            status: true,
            message: "Worker Advance Payment category created successfully!",
            data: workerAdvancePayment
        });
        
    }catch(err){

        return res.json({
            status: true,
            message: err.message,
            data: null
        });
    }    

}));

router.post("/fetchAll", auth, catchAsync(async (req, res, next) => {

    try{
      let workerAdvancePayment = []
      if(req.body.par){
        workerAdvancePayment = await WorkerAdvancePayment.find(req.body.par).populate("worker");
      }
      else{   
        workerAdvancePayment = await WorkerAdvancePayment.find().populate("worker");
        
      }
      if(workerAdvancePayment.length > 0){
        return res.json({
          status: true,
          message: "Advance Payment fetched successfully !.",
          data: workerAdvancePayment
        })
      }else{
        return res.json({
          status: false,
          message: "No Advance Payment found !.",
          data: []
        })
      }
    
      }catch(err){
        return res.json({
          status: false,
          message: err.message,
          data: []
        })
      }

}));

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