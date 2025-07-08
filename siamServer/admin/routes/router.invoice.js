const express = require("express")
const router = express.Router()
const RetailerInvoice = require("../model/model.retailerInvoice")
const Retailer = require("./../model/model.invoice")
const auth = require("../../middleware/auth")
const Order = require("../../retailer/mode")


// ============create a style==================

// router.post("/create", auth, async(req, res)=>{
//   try{


//     const retailer = await Retailer.find({retailer_code : req.body.invoice['retailer_code']})

//     const orderid = await Order.find({orderId : req.body.invoice['orderid']})

//     if(!orderid.length == 1){

//       return res.json({
//         status: false,
//         message: "Cannot find any order with this order ID!.",
//         data: null
//       })      

//     }else if(!retailer.length == 1){

//       return res.json({
//         status: false,
//         message: "Cannot find any retailer with this Retailer code !.",
//         data: null
//       })

//     }

//     const retailerInvoice = new RetailerInvoice(req.body.invoice)

//     await retailerInvoice.save()
  
//     return res.json({
//       status: true,
//       message: "invoice created successfully!",
//       data: req.body.invoice
//     })

   

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })


// // ================fetch All Styles===================


// router.post("/fetchAll/:skip/:limit", auth, async(req, res)=>{
//   try{
//     const retailerInvoice = await RetailerInvoice.find().skip(req.params.skip).limit(req.params.limit)
//     if(!retailerInvoice.length > 0){
//       return res.json({
//         status: false,
//         message: "No Invoice found!",
//         data: null
//       })
//     }
//     return res.json({
//       status: true,
//       message: "Invoice fetched successfully",
//       data: retailerInvoice
//     })
//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })


// // ================fetch a specific invoice===================


// router.post("/fetch/:id", auth, async(req, res)=>{
//   try{
//     const retailerInvoice = await RetailerInvoice.find({_id: req.params.id})
//     if(!retailerInvoice.length > 0){
//       return res.json({
//         status: false,
//         message: "No Invoice found with this ID!",
//         data: null
//       })
//     }
//     return res.json({
//       status: true,
//       message: "Invoice fetched successfully",
//       data: retailerInvoice
//     })
//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })

// // ================Fetch for a retialer==================

// router.post("/fetchRetailerInovice/:id", auth, async(req, res)=>{
//   try{
//     const retailerInvoice = await RetailerInvoice.find({retailer_code: req.params.id})
//     if(!retailerInvoice.length > 0){
//       return res.json({
//         status: false,
//         message: "No Invoice found for this retailer",
//         data: null
//       })
//     }
//     return res.json({
//       status: true,
//       message: "Invoices Fetch for the Retailer successfully",
//       data: retailerInvoice
//     })
//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })

// // ---------------------Edit Retailer -----------------------

// router.put("/update/:id", auth, async(req, res)=>{

//   try{

//     const retailerInvoiceToBeUpdated = await RetailerInvoice.find({_id: req.params.id})

//     if(!retailerInvoiceToBeUpdated.length > 0){
//       return res.json({
//         status: false,
//         message: "No such Invoice found",
//         data: null
//       })
//     }


//     const retailer = await Retailer.find({retailer_code : req.body.invoice['retailer_code']})

//     const orderid = await Order.find({orderId : req.body.invoice['orderid']})

//     if(!orderid.length == 1){

//       return res.json({
//         status: false,
//         message: "Cannot find any order with this order ID!.",
//         data: null
//       })      

//     }else if(!retailer.length == 1){

//       return res.json({
//         status: false,
//         message: "Cannot find any retailer with this Retailer code !.",
//         data: null
//       })

//     }

//     const updatedInovice = await RetailerInvoice.findOneAndUpdate({_id: req.params.id}, req.body.invoice)

//     return res.json({
//       status: true,
//       message: "Invoice updated successfully",
//       data: updatedInovice
//     })

//   }catch(err){
    
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
    
//   }
// })

// // ================delete a specific style===================


// router.post("/delete/:id", auth, async(req, res)=>{
//   try{

//     const retailerInvoice = await RetailerInvoice.find({_id: req.params.id})
//     if(retailerInvoice.length > 0 ){
      
//     await RetailerInvoice.deleteOne({_id: req.params.id});
    
//     return res.json({
//       status: true,
//       message: "Invoice deleted successfully!",
//       data: null
//     })
//   }else{
//     return res.json({
//       status: false,
//       message: "No Invoice found with this ID!",
//       data: null
//     })
//   }
    
//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
    
//   }

// })


module.exports = router