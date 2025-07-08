const express = require("express")
const router = express.Router()
const auth = require("../../middleware/auth")
const Order = require("../../retailer/model/model.Order");
const GroupOrder = require("./../model/model.groupOrder")
const Product = require("./../../admin/model/model.products")
const APIFeatures = require("../../utills/apiFeatures");
const catchAsync = require('../../utills/catchAsync');
// const AppError = require('../../utills/appError');
const qr = require('qr-image');
const fs = require('fs');
const { default: puppeteer } = require('puppeteer');
const path = require('path')
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk")
const KEY_ID = process.env.ACCESS_KEY;
const SECRET_ID = process.env.SECRET_KEY;
const BucketName = "siamsuits";
const PDFDocument = require('pdfkit');
const { findById, findOne } = require("../model/model.customerMeasurement");
const { Signer } = require("aws-sdk/clients/cloudfront");
const mongoose = require('mongoose');
const s3 = new AWS.S3({
  accessKeyId: KEY_ID,
  secretAccessKey: SECRET_ID
})
const PicBaseUrl3 = require("./../../config")


const PicBaseUrl = "https://siamsuits.s3.ap-northeast-1.amazonaws.com/images/";


const OrderSerializer = data => ({
  _id: data._id,
  orderId: data.orderId,
  customerName: data.customerName,
  retailerName: data.retailerName,
  retailer_id: data.retailer_id,
  retailer_code: data.retailer_code,
  customer_id: data.customer_id,
  measurements: data.measurements,
  Suitmeasurements: data.Suitmeasurements,
  Tuxedomeasurements: data.Tuxedomeasurements,
  order_items: data.order_items,
  total_quantity: data.total_quantity,
  order_status: data.order_status,
  OrderDate: data.OrderDate,
  rushOrderDate: data.rushOrderDate,
  orderCancle: data.orderCancle,
  date: data.date
});

function toJSONLocal(date) {
  var local = new Date(date);
  local.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return local.toJSON().slice(0, 10);
}


// ---------------------Fetches all orders----------------------

router.post("/fetchAll", auth, async (req, res) => {
  try {
    if (!req.body.par) req.body.par = {}; // Ensure par exists
    req.body.par.type = "normal"; // Add type condition
    console.log(req.body.par)
    const orders = await Order.find(req.body.par)
      .sort({ date: -1 }) // Correct sorting syntax
      .populate("customer_id")
      .populate("retailer_id");
    
    

    if (orders.length > 0) {

      return res.json({
        status: true,
        message: "Orders fetched successfully",
        data: orders
      })

    } else {

      return res.json({
        status: false,
        message: "No orders found",
        data: null
      })

    }

  } catch (err) {

    return res.json({
      status: true,
      message: err.message,
      data: null
    })

  }

})

router.put("/updateStatus/:id", auth, async (req, res) => {
  try {
    let updateOrder = await Order.findByIdAndUpdate(req.params.id, { order_status: req.body.order_status }, { new: true })
    return res.json({
      status: true,
      message: "Orders status updated successfully",
      data: updateOrder
    })
  }
  catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

router.put("/updateStatusWithOrderID/:id", auth, async (req, res) => {
  try {
    let updateOrder = await Order.findOneAndUpdate({orderId: req.params.id}, { order_status: req.body.order_status }, { new: true })
    return res.json({
      status: true,
      message: "Orders status updated successfully",
      data: updateOrder
    })
  }
  catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})
// router.post("/fetchPaginate", auth, catchAsync(async (req, res, next) => {
//   let filter = {};
//   // let filter2 = {};
//   if (req.params.order_status) filter = { order_status: req.params.order_status };
//   const features = new APIFeatures(Order.find(filter).populate("customer_id retailer_id"), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const data = await features.query;
//   const statusCount = await Order.countDocuments(filter);

//   if (!data) {
//     return next(new AppError('No document found', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     count: statusCount,
//     results: data.length,
//     data: data,

//   });

// }));

router.post("/fetchFiltered/:retailer_code", auth, async(req, res, next) => {

  try {

    const data = await Order.find({ retailer_code: req.params.retailer_code }).sort({ date: -1 }).populate("customer_id").populate("retailer_id");
    if (data.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: data
      })

    } else {

      return res.json({
        status: false,
        message: "No data found",
        data: []
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

// -----------------Fetch A specific order---------------------

router.post("/fetch", auth, async (req, res) => {
  try {

    const orders = await Order.find({ orderId: req.body.order_id })

    if (orders.length > 0) {

      return res.json({
        status: true,
        message: "Order fetched successfully",
        data: orders
      })

    } else {

      return res.json({
        status: false,
        message: "No order found with this Id",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }

});

// -----------------Fetch  orders according to the status---------------------

router.get("/fetch/status", auth, async (req, res) => {

  try {

    const orders = await Order.find({ order_status: req.body.status }).populate("customer_id").populate("retailer_id")

    if (orders.length > 0) {

      return res.json({
        status: true,
        message: "Orders fetched successfully",
        data: orders
      })

    } else {

      return res.json({
        status: false,
        message: "No orders found with this status",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: false,
      message: err.message,
      data: null
    })

  }

})


router.put("/updateOrderWithStatusCode/:id", auth, async (req, res) => {
  try {
    let date = new Date();
    const data = await Order.findByIdAndUpdate(
      req.params.id,
      {
        order_items: req.body.order.order_items,
        order_status: req.body.order.order_status,
        total_quantity: req.body.order.total_quantity,
        measurements: req.body.order.measurements,
        Suitmeasurements: req.body.order.Suitmeasurements,
        manualSize:req.body.order.manualSize,
        orderDate: req.body.order.orderDate || date.toLocaleDateString("es-CL"),
        date: Date.now()
      },
      { new: true }
      // req.body.order
    );

    return res.json({
      status: true,
      message: "Order updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

// --------------changes the status of the order-----------------------

// router.put("/updateStatus", auth, async(req, res)=>{ 
//   try
//   {
//     let updateOrder = await Order.findOneAndUpdate({order_id: req.body.order_id}, {order_status: req.body.order_status})
//     return res.json({
//       status: true,
//       message: "Orders status updated successfully",
//       data: updateOrder
//     })
//   }
//   catch(err)
//   {
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })  


// ---------------------create a manual order----------------------

router.post("/create", auth, async (req, res) => {
  try {
    const fetchExistingOrder = await Order.find({retailer_code: req.body.order.retailer_code});
    const products = await Product.find()
    const processObject = {}
    for (let x of products){
      processObject[x['name']] = x['process']
    } 
    let productProcessObject = {}
    let manufacturing = {}
    for(let x of req.body.order.order_items){
      if(x['item_name'] == 'suit'){
        productProcessObject['jacket'] = {}
        for(let m of processObject['jacket']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['jacket'][m] = obj
          }else{
            productProcessObject['jacket'] = {
              m: obj
            }
          }
          
         }
         
        productProcessObject['pant'] = {}
         for(let m of processObject['pant']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['pant'][m] = obj
          }else{
            productProcessObject['pant'] = {
              m: obj
            }
          }
          
         }
        
        for(let i =0; i < x['quantity']; i++){
          manufacturing[x['item_name']+"_jacket_"+i] = productProcessObject['jacket']
          manufacturing[x['item_name']+"_pant_"+i] = productProcessObject['pant']
        } 
      }else if(x['item_name'] == 'tuxedo'){
        productProcessObject['tuxedojacket'] = {}
        for(let m of processObject['tuxedojacket']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['tuxedojacket'][m] = obj
          }else{
            productProcessObject['tuxedojacket'] = {
              m: obj
            }
          }
          
         }
         
        productProcessObject['pant'] = {}
         for(let m of processObject['pant']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['pant'][m] = obj
          }else{
            productProcessObject['pant'] = {
              m: obj
            }
          }
          
         }
        
        for(let i =0; i < x['quantity']; i++){
          manufacturing[x['item_name']+"_tuxedojacket_"+i] = productProcessObject['tuxedojacket']
          manufacturing[x['item_name']+"_pant_"+i] = productProcessObject['pant']
        } 
      }else{
        productProcessObject[x['item_name']] = {}
        for(let m of processObject[x['item_name']]){
          const obj = {}     
          obj['status'] = 0;
          obj['tailor_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject[x['item_name']][m] = obj
          }else{
            productProcessObject[x['item_name']] = {
              m: obj
            }
          }
          
         }
        
          for(let i =0; i < x['quantity']; i++){
            manufacturing[x['item_name']+"_"+i] = productProcessObject[x['item_name']]
          }    
      }
      
    }
    let priceObject = {};
    let stylingObject = {}
    for (let product of req.body.order.order_items){
      
      if(product['item_name'] == 'suit'){
        let i = 0;

        for(let items of Object.keys(product['styles'])){        
          let price = {};
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let jacketPrice = 0
          if(product['styles'][items]['jacket']['style']){
              for(let styles of Object.keys(product['styles'][items]['jacket']['style'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][items]['jacket']['style'][styles]['workerprice'])
              
              if(Number(product['styles'][items]['jacket']['style'][styles]['workerprice']) > 0){
                // console.og()
                stylingPriceObjectJacket[product['styles'][items]['jacket']['style'][styles]['value']] = Number(product['styles'][items]['jacket']['style'][styles]['workerprice'])
              }
              

          }
           
          }
          if(product['styles'][items]['jacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][items]['jacket']['groupStyle'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][items]['jacket']['groupStyle'][styles]['workerprice'])

              if(Number(product['styles'][items]['jacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectJacket[product['styles'][items]['jacket']['groupStyle'][styles]['value']] = Number(product['styles'][items]['jacket']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          
          if(product['styles'][items]['pant']['style']){
            for(let styles of Object.keys(product['styles'][items]['pant']['style'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][items]['pant']['style'][styles]['workerprice'])
              if(Number(product['styles'][items]['pant']['style'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][items]['pant']['style'][styles]['value']] = Number(product['styles'][items]['pant']['style'][styles]['workerprice'])
              }
            }
          }
            if(product['styles'][items]['pant']['groupStyle']){
                for(let styles of Object.keys(product['styles'][items]['pant']['groupStyle'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice'])
              if(Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][items]['pant']['groupStyle'][styles]['value']] = Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          priceObject["suit_" + 'jacket' + "_" + i] = Number(jacketPrice)
          priceObject["suit_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["suit_" + 'jacket' + "_" + i] = stylingPriceObjectJacket
          stylingObject["suit_" + 'pant' + "_" + i] = stylingPriceObjectPant
          i = i + 1
        }
      }else if(product['item_name'] == 'tuxedo'){
        let i = 0;

        for(let items of Object.keys(product['styles'])){        
          let price = {};
          let stylingPriceObjectTuxedoJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let tuxedoJacketPrice = 0
          if(product['styles'][items]['tuxedojacket']['style']){
              for(let styles of Object.keys(product['styles'][items]['tuxedojacket']['style'])){
                tuxedoJacketPrice = Number(tuxedoJacketPrice) + Number(product['styles'][items]['tuxedojacket']['style'][styles]['workerprice'])
              
              if(Number(product['styles'][items]['tuxedojacket']['style'][styles]['workerprice']) > 0){
                // console.og()
                stylingPriceObjectTuxedoJacket[product['styles'][items]['tuxedojacket']['style'][styles]['value']] = Number(product['styles'][items]['tuxedojacket']['style'][styles]['workerprice'])
              }
              

          }
           
          }
          if(product['styles'][items]['tuxedojacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][items]['tuxedojacket']['groupStyle'])){
                  tuxedoJacketPrice = Number(tuxedoJacketPrice) + Number(product['styles'][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])

              if(Number(product['styles'][items]['tuxedojacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectTuxedoJacket[product['styles'][items]['tuxedojacket']['groupStyle'][styles]['value']] = Number(product['styles'][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          
          if(product['styles'][items]['pant']['style']){
            for(let styles of Object.keys(product['styles'][items]['pant']['style'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][items]['pant']['style'][styles]['workerprice'])
              if(Number(product['styles'][items]['pant']['style'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][items]['pant']['style'][styles]['value']] = Number(product['styles'][items]['pant']['style'][styles]['workerprice'])
              }
            }
          }
            if(product['styles'][items]['pant']['groupStyle']){
                for(let styles of Object.keys(product['styles'][items]['pant']['groupStyle'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice'])
              if(Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][items]['pant']['groupStyle'][styles]['value']] = Number(product['styles'][items]['pant']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          priceObject["tuxedo_" + 'tuxedojacket' + "_" + i] = Number(tuxedoJacketPrice)
          priceObject["tuxedo_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["tuxedo_" + 'tuxedojacket' + "_" + i] = stylingPriceObjectTuxedoJacket
          stylingObject["tuxedo_" + 'pant' + "_" + i] = stylingPriceObjectPant
          i = i + 1
        }
      }else{
        for(let items of Object.keys(product['styles'])){
          const styleObj = {}
            let price = 0;
            if(product['styles'][items]['style']){
                for(let styles of Object.keys(product['styles'][items]['style'])){
                  price = Number(price) + Number(product['styles'][items]['style'][styles]['workerprice'])
                  if(Number(product['styles'][items]['style'][styles]['workerprice']) > 0){
                    styleObj[product['styles'][items]['style'][styles]['value']] = Number(product['styles'][items]['style'][styles]['workerprice'])
                  }
                }                
            }
            if(product['styles'][items]['groupStyle']){
              for(let styles of Object.keys(product['styles'][items]['groupStyle'])){
                price = Number(price) + Number(product['styles'][items]['groupStyle'][styles]['workerprice'])
                if(Number(product['styles'][items]['groupStyle'][styles]['workerprice']) > 0){
                  styleObj[product['styles'][items]['groupStyle'][styles]['value']] = Number(product['styles'][items]['groupStyle'][styles]['workerprice'])
                }
              }
            }
            priceObject[items] = Number(price)
            stylingObject[items] = styleObj
        }
      }
    } 

    console.log(req.body.order)

    if(fetchExistingOrder.length > 0 ) {
      let date = new Date();
        const order = new Order({
          orderId: `${req.body.order.retailer_code}-000${
            Number(
              fetchExistingOrder[fetchExistingOrder.length - 1].orderId
                .split('-')
                .pop()          // take the LAST segment after the final “-”
            ) + 1
          }`,
        customerName: req.body.order.customerName,
        retailerName: req.body.order.retailerName,
        retailer_id: req.body.order.retailer_id,
        retailer_code: req.body.order.retailer_code,
        customer_id: req.body.order.customer_id,
        measurements: req.body.order.measurements,
        Suitmeasurements: req.body.order.Suitmeasurements,
        Tuxedomeasurements: req.body.order.Tuxedomeasurements,
        order_items: req.body.order.order_items,
        total_quantity: req.body.order.total_quantity,
        order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
        rushOrderDate: req.body.order.rushOrderDate,
        manufacturing: manufacturing,
        workerprice:priceObject,
        stylingprice: stylingObject,
        OrderDate: toJSONLocal(date),
        date: Date.now()  
      });

      try{
        await order.save();
      }catch(err){
        console.log(err)
        return res.json({
          status: false,
          message: err.message,
          data: null
        })
      }
  
      return res.json({
        status: true,
        message: "Order created successfully!",
        data: order
      });

    }else {

      console.log("second")
      let date = new Date();
      const order = new Order({
        orderId: `${req.body.order.retailer_code}-000${1}`,
        customerName: req.body.order.customerName,
        retailerName: req.body.order.retailerName,
        retailer_id: req.body.order.retailer_id,
        retailer_code: req.body.order.retailer_code,
        customer_id: req.body.order.customer_id,
        measurements: req.body.order.measurements,
        Suitmeasurements: req.body.order.Suitmeasurements,
        Tuxedomeasurements: req.body.order.Tuxedomeasurements,
        order_items: req.body.order.order_items,
        total_quantity: req.body.order.total_quantity,
        order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
        manufacturing: manufacturing,
        workerprice:priceObject,
        stylingprice: stylingObject,
        rushOrderDate: req.body.order.rushOrderDate,
        OrderDate: toJSONLocal(date),
        date: Date.now()
      });

      await order.save()
  
      return res.json({
        status: true,
        message: "Order created successfully!",
        data: order
      });
    }


  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});

router.post("/createRepeat", auth, async (req, res) => {
  try {

    const fetchExistingOrder = await Order.find({retailer_code: req.body.order.retailer_code});
    const products = await Product.find()
    const processObject = {}
    for (let x of products){
      processObject[x['name']] = x['process']
    }
 
    let productProcessObject = {}
    let manufacturing = {}
    for(let x of req.body.order.order_items){
      if(x['item_name'] == 'suit'){
        productProcessObject['jacket'] = {}
        for(let m of processObject['jacket']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['jacket'][m] = obj
          }else{
            productProcessObject['jacket'] = {
              m: obj
            }
          }
          
         }
         
        productProcessObject['pant'] = {}
         for(let m of processObject['pant']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['pant'][m] = obj
          }else{
            productProcessObject['pant'] = {
              m: obj
            }
          }
          
         }
        
        for(let i =0; i < x['quantity']; i++){
          manufacturing[x['item_name']+"_jacket_"+i] = productProcessObject['jacket']
          manufacturing[x['item_name']+"_pant_"+i] = productProcessObject['pant']
        } 
      }else{
        productProcessObject[x['item_name']] = {}
        for(let m of processObject[x['item_name']]){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject[x['item_name']][m] = obj
          }else{
            productProcessObject[x['item_name']] = {
              m: obj
            }
          }
          
         }
        
          for(let i =0; i < x['quantity']; i++){
            manufacturing[x['item_name']+"_"+i] = productProcessObject[x['item_name']]
          }    
      }
      
    }
    let priceObject = {};
    let stylingObject = {}
    for (let product of req.body.order.order_items){
      if(product['item_name'] == 'suit'){
        let i = 0;
        for(let items of Object.keys(product['styles'][0])){
          let pantPrice = 0;
          let jacketPrice = 0;
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          if(product['styles'][0][items]['jacket']['style']){
              for(let styles of Object.keys(product['styles'][0][items]['jacket']['style'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice']) > 0){
                stylingPriceObjectJacket[product['styles'][0][items]['jacket']['style'][styles]['value']] = Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice'])
              }
          }
           
          }
          if(product['styles'][0][items]['jacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['jacket']['groupStyle'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectJacket[product['styles'][0][items]['jacket']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          
          if(product['styles'][0][items]['pant']['style']){
              for(let styles of Object.keys(product['styles'][0][items]['pant']['style'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][0][items]['pant']['style'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['pant']['style'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][0][items]['pant']['style'][styles]['value']] = Number(product['styles'][0][items]['pant']['style'][styles]['workerprice'])
              }
          }
              
          }
          if(product['styles'][0][items]['pant']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['pant']['groupStyle'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice'])  
              if(Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][0][items]['pant']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          priceObject["suit_" + 'jacket' + "_" + i] = Number(jacketPrice)
          priceObject["suit_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["suit_" + 'jacket' + "_" + i] = stylingPriceObjectJacket
          stylingObject["suit_" + 'pant' + "_" + i] = stylingPriceObjectPant
          i = i + 1
        }
      }else{
        for(let items of Object.keys(product['styles'][0])){
          
          const styleObj = {}
            let price = 0;
            if(product['styles'][0][items]['style']){
                for(let styles of Object.keys(product['styles'][0][items]['style'])){
                price = Number(price) + Number(product['styles'][0][items]['style'][styles]['workerprice'])
                if(Number(product['styles'][0][items]['style'][styles]['workerprice']) > 0){
                  styleObj[product['styles'][0][items]['style'][styles]['value']] = Number(product['styles'][0][items]['style'][styles]['workerprice'])
                }
            }
                
            }
            if(product['styles'][0][items]['groupStyle']){
                  for(let styles of Object.keys(product['styles'][0][items]['groupStyle'])){
                price = Number(price) + Number(product['styles'][0][items]['groupStyle'][styles]['workerprice'])
                if(Number(product['styles'][0][items]['groupStyle'][styles]['workerprice']) > 0){
                  styleObj[product['styles'][0][items]['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['groupStyle'][styles]['workerprice'])
                }
            }
            }
            priceObject[items] = Number(price)
            stylingObject[items] = styleObj
        }
      }
    }

    if(fetchExistingOrder.length > 0 ) {

      let date = new Date();
      const order = new Order({
        orderId: `${req.body.order.retailer_code}-000${
          Number(
            fetchExistingOrder[fetchExistingOrder.length - 1].orderId
              .split('-')
              .pop()          // take the LAST segment after the final “-”
          ) + 1
        }`,
        customerName: req.body.order.customerName,
        retailerName: req.body.order.retailerName,
        retailer_id: req.body.order.retailer_id,
        retailer_code: req.body.order.retailer_code,
        customer_id: req.body.order.customer_id,
        measurements: req.body.order.measurements,
        Suitmeasurements:req.body.order.Suitmeasurements,
        order_items: req.body.order.order_items,
        manufacturing: manufacturing,
        workerprice:priceObject,
        stylingprice: stylingObject,
        total_quantity: req.body.order.total_quantity,
        order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
        rushOrderDate: req.body.order.rushOrderDate,
        repeatOrder: true,
        OrderDate: date.toLocaleDateString("es-CL"),
        repeatOrderID: req.body.order.repeatOrderID,
        date: Date.now()
      });
  
      await order.save()
  
      return res.json({
        status: true,
        message: "Order created successfully!",
        data: order
      });

    }else {
      let date = new Date();
      const order = new Order({
        orderId: `${req.body.order.retailer_code}-000${1}`,
        customerName: req.body.order.customerName,
        retailerName: req.body.order.retailerName,
        retailer_id: req.body.order.retailer_id,
        retailer_code: req.body.order.retailer_code,
        customer_id: req.body.order.customer_id,
        measurements: req.body.order.measurements,
        Suitmeasurements:req.body.order.Suitmeasurements,
        order_items: req.body.order.order_items,
        manufacturing: manufacturing,
        workerprice: priceObject,
        stylingprice: stylingObject,
        total_quantity: req.body.order.total_quantity,
        order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
        repeatOrder: true,
        rushOrderDate: req.body.order.rushOrderDate,
        OrderDate: date.toLocaleDateString("es-CL"),
        date: Date.now()
      });
  
      await order.save()
  
      return res.json({
        status: true,
        message: "Order created successfully!",
        data: order
      });
    }


  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});

router.put("/updateOrder/:id", auth, async (req, res) => {
  try {
    const order = await Order.findOne({_id: req.params.id})

    if(!order){
      return res.json({
        status: false,
        message: "No Order Founf with this ID.",
        data: null
      })
    }

    const products = await Product.find()
    const processObject = {}
    for (let x of products){
      processObject[x['name']] = x['process']
    } 
    let productProcessObject = {}
    let manufacturing = {}
    for(let x of req.body.order.order_items){
      if(x['item_name'] == 'suit'){
        productProcessObject['jacket'] = {}
        for(let m of processObject['jacket']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['jacket'][m] = obj
          }else{
            productProcessObject['jacket'] = {
              m: obj
            }
          }
          
         }
         
        productProcessObject['pant'] = {}
         for(let m of processObject['pant']){
          const obj = {}     
          obj['status'] = 0;
          obj['tailer_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject['pant'][m] = obj
          }else{
            productProcessObject['pant'] = {
              m: obj
            }
          }
          
         }
        
        for(let i =0; i < x['quantity']; i++){
          manufacturing[x['item_name']+"_jacket_"+i] = productProcessObject['jacket']
          manufacturing[x['item_name']+"_pant_"+i] = productProcessObject['pant']
        } 
      }else{
        productProcessObject[x['item_name']] = {}
        for(let m of processObject[x['item_name']]){
          const obj = {}     
          obj['status'] = 0;
          obj['tailor_id'] = "";  
          if(Object.keys(productProcessObject).length > 0){
            productProcessObject[x['item_name']][m] = obj
          }else{
            productProcessObject[x['item_name']] = {
              m: obj
            }
          }
          
         }
        
          for(let i =0; i < x['quantity']; i++){
            manufacturing[x['item_name']+"_"+i] = productProcessObject[x['item_name']]
          }    
      }
      
    }
    let priceObject = {};
    let stylingObject = {}
    for (let product of req.body.order.order_items){
      
      if(product['item_name'] == 'suit'){
        let i = 0;
        for(let items of Object.keys(product['styles'][0])){
          let price = {};
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let jacketPrice = 0
          if(product['styles'][0][items]['jacket']['style']){
            for(let styles of Object.keys(product['styles'][0][items]['jacket']['style'])){
                jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice'])              
                if(Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice']) > 0){
                  stylingPriceObjectJacket[product['styles'][0][items]['jacket']['style'][styles]['value']] = Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice'])
                }
            }
           
          }
          if(product['styles'][0][items]['jacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['jacket']['groupStyle'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice'])

              if(Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectJacket[product['styles'][0][items]['jacket']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['jacket']['groupStyle'][styles]['workerprice'])
              }
          }
          }
          
            if(product['styles'][0][items]['pant']['style']){
              for(let styles of Object.keys(product['styles'][0][items]['pant']['style'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][0][items]['pant']['style'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['pant']['style'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][0][items]['pant']['style'][styles]['value']] = Number(product['styles'][0][items]['pant']['style'][styles]['workerprice'])
              }
              
          }
              
          }
          if(product['styles'][0][items]['pant']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['pant']['groupStyle'])){
              pantPrice = Number(pantPrice) + Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectPant[product['styles'][0][items]['pant']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['pant']['groupStyle'][styles]['workerprice'])
              }[0]
          }
          }

          priceObject["suit_" + 'jacket' + "_" + i] = Number(jacketPrice)
          priceObject["suit_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["suit_" + 'jacket' + "_" + i] = stylingPriceObjectJacket
          stylingObject["suit_" + 'pant' + "_" + i] = stylingPriceObjectPant

          i = i + 1 
        }
      }else{
        for(let items of Object.keys(product['styles'][0])){
          const styleObj = {}
            let price = 0;
            if(product['styles'][0][items]['style']){
                for(let styles of Object.keys(product['styles'][0][items]['style'])){
                price = Number(price) + Number(product['styles'][0][items]['style'][styles]['workerprice'])
                if(Number(product['styles'][0][items]['style'][styles]['workerprice']) > 0){
                  styleObj[product['styles'][0][items]['style'][styles]['value']] = Number(product['styles'][0][items]['style'][styles]['workerprice'])
                }
            } 
                
            }
            if(product['styles'][0][items]['groupStyle']){
                  for(let styles of Object.keys(product['styles'][0][items]['groupStyle'])){
                price = Number(price) + Number(product['styles'][0][items]['groupStyle'][styles]['workerprice'])
                if(Number(product['styles'][0][items]['groupStyle'][styles]['workerprice']) > 0){
                  styleObj[product['styles'][0][items]['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['groupStyle'][styles]['workerprice'])
                }
            }
            }
            priceObject[items] = Number(price)
            stylingObject[items] = styleObj
        }
      }
    }

    const data = await Order.findByIdAndUpdate(
      req.params.id,
      {
        order_items: req.body.order.order_items,
        total_quantity: req.body.order.total_quantity,
        rushOrderDate: req.body.order.rushOrderDate,
        order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
        measurements: req.body.order.measurements,
        Suitmeasurements: req.body.order.Suitmeasurements,
        manufacturing: manufacturing,
        workerprice: priceObject,
        stylingprice: stylingObject,
        date: Date.now()

      },
      { new: true } 
    );

    return res.json({
      status: true,
      message: "Order updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

router.post("/RetailerfetchPaginate", auth, catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.query.order_status) filter = { order_status: req.query.order_status, retailer_code: req.query.retailer_code };

  const features = new APIFeatures(Order.find(filter).sort({ date: -1 }).populate("customer_id retailer_id"), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const data = await features.query;
  const statusCount = await Order.countDocuments(filter);

  if (!data) {
    return next(new AppError('No document found', 404));
  }

  res.status(200).json({
    status: 'success',
    count: statusCount,
    results: data.length,
    data: data,

  });

}));

// -----------------Fetch A specific order---------------------//

router.post("/fetch/:retailer_code", auth, async (req, res, next) => {
  try {

    const data = await Order.find({ retailer_code: req.params.retailer_code }).sort({ date: 'desc' }).populate("customer_id").populate("retailer_id");

    if (data.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: data
      })

    } else {

      return res.json({
        status: false,
        message: "No data found",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/fetchOrderByID/:order", auth, async (req, res) => {
  try {

    const order = await Order.find({ _id: req.params.order }).populate('customer_id').populate('retailer_id')

    if (order.length > 0) {

      return res.json({
        status: true,
        message: "Order fetched successfully",
        data: order
      })

    } else {

      return res.json({
        status: false,
        message: "No order found with this Id",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }

});

router.post("/fetchCustomerOrders/:customer", auth, async (req, res, next) => {

  try {
    const orders = await Order.find({ customer_id: req.params.customer })

    if (orders.length > 0) {

      return res.json({
        status: true,
        message: "Order fetched successfully",
        data: orders
      })

    } else {

      return res.json({
        status: false,
        message: "No order found with this Id",
        data: []
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/fetchPaginate", auth, async (req, res) => {
  
  try {
    let page = req.query.page ;
    let limit = req.query.limit;
    let order_status = req.query.order_status ;
    let customerName = req.query.customerName ;
    let retailerName = req.query.retailerName ;
    let orderDate = req.query.orderDate;
    let query = {};

    if (order_status && order_status !== "null") {
      query = { order_status: new RegExp(`${order_status}+`, "i") }
    }

    if (customerName && customerName !== "null") {
      query = { customerName: new RegExp(`${customerName}+`, "i") }
    }

    if (retailerName && retailerName !== "null") {
      query = { retailerName: new RegExp(`${retailerName}+`, "i") }
    }

    if (orderDate && orderDate !== "null") {
      query = { orderDate: new RegExp(`${orderDate}+`, "i") }
    }
    const paginated = await Order.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        populate: "customer_id retailer_id",
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(OrderSerializer));

    delete paginated["docs"];
    const meta = paginated;

    res.json({ meta, data });
  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    });
  }
});

router.put("/deleteProduct/:id/:order_items", auth, catchAsync(async (req, res, next) => {

  const deleteData = await Order.findByIdAndUpdate(
    req.params.id,
    { $pull: { order_items: { _id: req.params.order_items } } },
    { new: true }
  )

  if (!deleteData) {
    return next(new AppError('Process failed!', 404));
  }

  res.status(200).json({
    message: 'Product deleted successfully!'
  });
}));

router.post("/OrderCancel/:id", auth,async(req, res, next) => {

  try {
    const data = await Order.findByIdAndUpdate(
      req.params.id,
    { orderCancle: "Yes" },
    { new: true }
    );

   if(!data) {
    return res.json({
      status: false,
      message: "failed"
    })
   }

   return res.json({
      status: true,
      message: "Order updated successfully",
      data: data
    });

  }
  
  catch (err) {
    return res.json({
      status: false,
      message: err.message,
    });
  }
});

// invoice 
router.post("/updateProductInvoice/:id", auth, async (req, res) => {
  try {
    const data = await Order.findByIdAndUpdate(
      req.params.id,
      {
        invoice:req.body.invoice,
        invoiceCreate: true
      },
      { new: true }
      // req.body.order
    );

    return res.json({
      status: true,
      message: "Order updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

router.post("/fetchRetailerPaginate", auth, async (req, res) => {
  try {

   let page = req.query.page;
    let limit = req.query.limit;
    let order_status = req.query.order_status;
    let retailer_code = req.query.retailer_code;
    let orderId = req.query.orderId;
    
    let query = {};

    if (retailer_code && retailer_code !== "null") {
      query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    }

    if (order_status && order_status !== "null") {
      query = { order_status: new RegExp(`${order_status}+`, "i") }
    }

    if (orderId && orderId !== "null") {
      query = { orderId: new RegExp(`${orderId}+`, "i") }
    }

    const paginated = await Order.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        populate: "customer_id retailer_id",
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(OrderSerializer));

    delete paginated["docs"];
    const meta = paginated;

    res.json({ meta, data });
  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: []
    });
  }
});


router.post("/fetchRetailerPaginateNew/:skip", auth, async(req, res) => {

  try{
    let obj  = {}
    if(req.body.par.order_status.length > 0){
      obj = req.body.par
    }else{
      obj = req.body.par
      delete obj['order_status']
    }

    let obj2  = {}
    if(req.body.count.order_status.length > 0){
      obj2 = req.body.count
    }else{
      obj2 = req.body.count
      delete obj2['order_status']
    }

    obj['type'] = "normal"
    obj2['type'] = "normal"
    const orders = await Order.find(obj).sort({date: -1}).limit(5).skip(req.params.skip)
    const ordersCount = await Order.find(obj2)
    const count = ordersCount.length
    if(orders.length < 1){
      return res.json({
        status: false,
        message: "No Orders Found",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Orders fetched successfully.!",
      data: orders,
      docCount: count
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

router.post("/fetchAdminPaginateNew/:skip", auth, async(req, res) => {

  try{
    req.body.par.type = "normal"
    const orders = await Order.find(req.body.par).sort({date: -1}).limit(5).skip(req.params.skip)
    req.body.count.type = "normal"
    // const ordersCount = await Order.find({order_status: req.body.par.order_status})
    const ordersCount = await Order.find(req.body.count)
    const count = ordersCount.length
    if(orders.length < 1){
      return res.json({
        status: false,
        message: "No Orders Found",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Orders fetched successfully.!",
      data: orders,
      docCount: count
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

router.put("/updateInvoiceStatus/:id", auth, async(req, res) => {
  try {

    const data = await Order.findByIdAndUpdate(req.params.id, {invoiceSent: true}, {new: true});

    return res.json({
      status: true,
      message: "Order invoice updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

// fetch order by like for retailer=================================

router.post("/fetchOrderByLikeRetailer/:retailer/:order", auth, async(req, res) => {
  try {
    const orders = await Order.find({orderId: { $regex: req.params.order, $options: 'i'}, retailer_id: req.params.retailer});

    if (orders.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: orders
      })

    } else {

      return res.json({
        status: false,
        message: "No orders found by this ID",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
})


// fetch group order new from the orders=================================

router.post("/fetchGroupOrder/:id", auth, async (req, res) => {
  try {
    const data = await Order.find({ groupOrderID: req.params.id }).populate('groupOrderID').populate('customer_id')
    if (!data.length > 0) {
      return res.json({
        status: false,
        message: "Data not found",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "fetch data successfully",
      data: data
    })
  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});



router.post("/createPdf", auth, async(req, res) => {
  try{

    // const qrData = "https://www.example.com";

    // console.log(req.body)

// QR code image generation
// const qrImage = qr.imageSync(qrData, { type: 'png' });
const orderItemsArrayPDF = JSON.parse(req.body.orderItemsArray)
const singleOrderArray = JSON.parse(req.body.singleOrderArray)
const productFeaturesObject = JSON.parse(req.body.productFeaturesObject)
const draftMeasurementsObj = req.body.draftMeasurementsObj ? JSON.parse(req.body.draftMeasurementsObj) : null
const order = JSON.parse(req.body.order)
const retailer = JSON.parse(req.body.retailer)

const oldOrder = await Order.find({ customer_id: order['customer_id']._id }).sort({date: -1}).populate('customer_id').populate('retailer_id')


let repeatOrderId = "No";
if(order['repeatOrder'] == true){
  const repeatOrder = await Order.find({ _id: order['repeatOrderID'] }).populate('customer_id').populate('retailer_id')
  if(repeatOrder.length > 0){
    repeatOrderId = repeatOrder[0]['orderId']
  }
}

// for(let x of order)
let oldOrderId = "None";
if(oldOrder.length > 1){
  oldOrderId = oldOrder[1]['orderId']
}
const qrDataIndex = order['orderId']
const qrImageIndex = qr.imageSync(qrDataIndex, { type: 'png' });
const qrImageBase64Index = qrImageIndex.toString('base64');
let orderType = "Normal Order"
let showGroupOrderID = false
let groupOrderID = ""
if(order.type && order.type == "group"){
  const groupOrder = await GroupOrder.findOne({_id: order.groupOrderID}).lean()
  orderType = "Group Order";
  showGroupOrderID = true;
  groupOrderID = groupOrder.orderId

}
let html = '';
for(let i=0; i < orderItemsArrayPDF.length; i++){
  if (i == orderItemsArrayPDF.length - 1) {
    var variableLength = 5 - orderItemsArrayPDF[i].length;
  }

  var dummyElements = [];
  for (let x = 1; x <= variableLength; x++) {
    dummyElements.push(x);
  }

  html = html + '<div class="wraper" style="margin:10px; min-height:50vh; height:auto; page-break-after: always;">'+

      '<div class="inner-wraper w-100" style="border:1px solid;">'+
      '<div class="header-section" style="display: flex; justify-content: space-between; gap:20px; padding: 1rem; border-bottom: 1px solid;">'+

        '<div class="info" style="flex: 23%;">'+

                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Customer Name:</h5>'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize">'+ order.customerName +'</h5>'+
                  '</div>'+

                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Date:</h5>'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.OrderDate +' </h5>'+
                      '<span style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; position:absolute; right:0; text-transform:uppercase">'+ order['customer_id']['gender'] +'</span>'+
                  '</div>'+

                  // '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                  //     '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">OLD ORDER NO:</h5>'+
                  //     '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+oldOrderId +
                  //     '</h5>'+
                  // '</div>'+

                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Old Order:</h5>'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ oldOrderId +
                      '</h5>'+
                  '</div>';
                  if(order['order_status'] == "Modified"){
                    html = html +
                    
                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                  '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:red">Modified on :' + 
                  '</h5>'+ 
                  '</h5>'+
                  '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0">'+ new Date(order.date).toLocaleDateString() + 
                  '</h5>'+
              '</div>';
                  }

                  if(order['order_status'] == "Rush" || (order['rushOrderDate'] && order['rushOrderDate'].length > 0)){
                    html = html +
                    
                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                  '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:red">Rush Order :' + 
                  '</h5>'+ 
                  // '</h5>'+
                  '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0">'+ order['rushOrderDate'] + 
                  '</h5>'+
              '</div>';
                  }
                  if(order['repeatOrder'] == true){
                    html = html +
                    
                    '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                    '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:green">Repeat Order' + 
                    '</h5>'+ 
                    '</h5>'+
                '</div>';
                  }
                  html = html +
              '</div>'+

              '<div class="info" style="border:1px solid #000000;flex: 23%; text-align:center">'+
                   '<div clas="info-box">'+
                   '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+ order.orderId +'</h5>'+
                   '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ orderType +'</h5>'+
                   '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ groupOrderID +'</h5>'+
                 '</div>'+
              '</div>'+

              '<div clas="info-box" style="text-align:center">'+
              '<img src=data:image/png;base64,'+qrImageBase64Index+' alt="logo" class="img-fluid" style="width:80px; object-fit: contain; object-position: 100% 100%;"><br><span style="font-size:.6rem; text-align:center">'+qrDataIndex+'</span>'+
            '</div>'+
             
              '<div class="info" style="flex: 23%;">'+
                  '<div clas="info-box" style="text-align:center">'+
                    '<img src="' + PicBaseUrl + retailer["retailer_logo"] +  '" alt="logo" class="img-fluid" style="width:100px; object-fit: contain; object-position: 100% 100%;">'+
                 '</div>'+
             '</div>'+
    
          '</div>'+

          '<div class="tabel-details" style="page-break-after: always;">'+
             
              '<table class="table table-bordered" style="width:100%; border-collapse: collapse; border-spacing:0;">'+
              
                  '<tbody>';
                  for(let singles of orderItemsArrayPDF[i]){

                    let qrData = "";
                    let itemName = "";
                    if(singles.item_name == 'suit'){
                      qrData = order.orderId + "/"+'suit_' + singles.item_code.split(" ")[0] + "_" + Number(singles.item_code.split(" ")[1]-1);
                    }else if(singles.item_name == 'tuxedo'){
                      qrData = order.orderId + "/"+'tuxedo_' + singles.item_code.split(" ")[0] + "_" + Number(singles.item_code.split(" ")[1]-1);
                    }else{
                      qrData = order.orderId + "/" + singles.item_code.split(" ")[0] + "_" + Number(singles.item_code.split(" ")[1]-1);
                    }
                    const qrImage = qr.imageSync(qrData, { type: 'png' });
                    const qrImageBase64 = qrImage.toString('base64');
                    if(singles.item_name == 'suit'){
                      html =  html +        
                      '<tr>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+ singles.item_name + " " + singles.item_code.split(" ")[1] +'</td>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">Suit '+ singles.item_code.split(" ")[0] + '</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+  singles.styles.fabric_code +'</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px; "><img src=data:image/png;base64,'+qrImageBase64+' style="width:80px; height:80px"><br><span style="font-size:.6rem; text-align:center">'+qrData+'</span></td>'+
                      '</tr>';
                    }else  if(singles.item_name == 'tuxedo'){
                      html =  html +        
                      '<tr>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+ singles.item_name + " " + singles.item_code.split(" ")[1] +'</td>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">Tuxedo '+ singles.item_code.split(" ")[0] + '</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+  singles.styles.fabric_code +'</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px; "><img src=data:image/png;base64,'+qrImageBase64+' style="width:80px; height:80px"><br><span style="font-size:.6rem; text-align:center">'+qrData+'</span></td>'+
                      '</tr>';
                    }else{
                      html =  html +        
                      '<tr>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+ singles.item_name + '</td>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+ singles.item_code + '</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+  singles.styles.fabric_code +'</td>'+
                        '<td style="border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px; "><img src=data:image/png;base64,'+qrImageBase64+' style="width:80px; height:80px"><br><span style="font-size:.6rem; text-align:center">'+qrData+'</span></td>'+
                      '</tr>';
                    }
              
                     
                   
                  }
            
                    
                  html = html + '</tbody>'+

                '</table>';

                if(i == orderItemsArrayPDF.length - 1){
                  html = html +
                  '<div class="total-quantiy" style="width: auto; height: auto; padding: 5px; border: 1px solid; margin: 10px; text-align: center; display:flex; flex:direction: row; justify-content: space-evenly">';
                  for(let items of order['order_items']){
                   html  = html + 
                   '<h4 style="font-size:1rem; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform: capitalize;">' + items["quantity"] + " " + items["item_name"] + '</h4>';
                  }
                  html = html +
                     '</div>';
                  
                }

             
          

          html = html  + 
          '</div>'+
         

      '</div>'+

  '</div>';

  // page section 2-------------------------------
}


for(let i=0; i < singleOrderArray.length; i++){

  // const qrData = order.orderId + "/" + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-0);
  let qrData = "";
  let itemName = "";
  if(singleOrderArray[i].item_name == 'suit'){
    qrData = order.orderId + "/"+'suit_' + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-1);
  }else if(singleOrderArray[i].item_name == 'tuxedo'){
    qrData = order.orderId + "/"+'tuxedo_' + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-1);
  }else{
    qrData = order.orderId + "/" + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-1);
  }
  const qrImage = qr.imageSync(qrData, { type: 'png' });
  const qrImageBase64 = qrImage.toString('base64');


  let fabricCode = "N/A";
  if(singleOrderArray[i]['styles']['fabric_code']){
    fabricCode = singleOrderArray[i]['styles']['fabric_code']
  }
  let liningCode = "N/A";
  if(singleOrderArray[i]['styles']['lining_code']){
    liningCode = singleOrderArray[i]['styles']['lining_code']
  }else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']){
    liningCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']
  }else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "pant" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']){
    liningCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']
  }else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']){
    liningCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']
  }else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "pant" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']){
    liningCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['lining_code']
  }

  let pipingCode = "N/A";
  if(singleOrderArray[i]['styles']['piping']){
    pipingCode = singleOrderArray[i]['styles']['piping']
  }else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']){
    pipingCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']
  }else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']){
    pipingCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']
  }


  // monogram details

  let monogramPosition = "";
  let monogramColor= "";
  let monogramFont= "";
  let monogramTag = "";
  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]["styles"]["jacket"]["monogram"] !== undefined){
    monogramColor = singleOrderArray[i]['styles']['jacket']['monogram']['color'] || "N/A"
    monogramFont = singleOrderArray[i]['styles']['jacket']['monogram']['font'] || "N/A"
    monogramPosition = singleOrderArray[i]['styles']['jacket']['monogram']['side'] || "Right Side"
    monogramTag = singleOrderArray[i]['styles']['jacket']['monogram']['tag'] || "N/A"
  } else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]["styles"]["jacket"]["monogram"] == undefined){
    monogramColor = "N/A"
    monogramFont = "N/A"
    monogramPosition = "Right Side" 
    monogramTag ="N/A"
  } else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket" && singleOrderArray[i]["styles"]["tuxedojacket"]["monogram"] !== undefined){
    monogramColor = singleOrderArray[i]['styles']['tuxedojacket']['monogram']['color'] || "N/A"
    monogramFont = singleOrderArray[i]['styles']['tuxedojacket']['monogram']['font'] || "N/A"
    monogramPosition = singleOrderArray[i]['styles']['tuxedojacket']['monogram']['side'] || "Right Side"
    monogramTag = singleOrderArray[i]['styles']['tuxedojacket']['monogram']['tag'] || "N/A"
  } else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket" && singleOrderArray[i]["styles"]["tuxedojacket"]["monogram"] == undefined){
    monogramColor = "N/A"
    monogramFont = "N/A"
    monogramPosition = "Right Side" 
    monogramTag ="N/A"
  }else if((singleOrderArray[i]['item_name'] !== 'suit' || singleOrderArray[i]['item_name'] !== 'tuxedo') && singleOrderArray[i]["styles"]["monogram"] !== undefined){
    if(singleOrderArray[i]['item_name'] == 'jacket'){
      monogramColor = singleOrderArray[i]['styles']['monogram']['color'] || "N/A"
      monogramFont = singleOrderArray[i]['styles']['monogram']['font'] || "N/A"
      monogramPosition = singleOrderArray[i]['styles']['monogram']['side'] || "Right Side" 
      monogramTag = singleOrderArray[i]['styles']['monogram']['tag'] || "N/A"
    }else{
      monogramColor = singleOrderArray[i]['styles']['monogram']['color'] || "N/A"
      monogramFont = singleOrderArray[i]['styles']['monogram']['font'] || "N/A"
      monogramPosition = singleOrderArray[i]['styles']['monogram']['side'] || "N/A"
      monogramTag = singleOrderArray[i]['styles']['monogram']['tag'] || "N/A"
    }
  }else if((singleOrderArray[i]['item_name'] !== 'suit' || singleOrderArray[i]['item_name'] !== 'tuxedo') && singleOrderArray[i]["styles"]["monogram"] == undefined){
    if(singleOrderArray[i]['item_name'] == 'jacket'){
      monogramColor = "N/A"
      monogramFont = "N/A"
      monogramPosition = "Right Side" 
      monogramTag ="N/A"
    }else{
      monogramColor = "N/A"
      monogramFont = "N/A"
      monogramPosition = "N/A"
      monogramTag ="N/A"
    }
  }
  

let manualImageUrl = "";
let fittingTypeString = 'NA';
let measurementNoteString = "N/A";
if(singleOrderArray[i]['measurementsObject']['fitting_type']){
  fittingTypeString = singleOrderArray[i]['measurementsObject']['fitting_type'];
}
if(singleOrderArray[i]['measurementsObject']['notes']){
  measurementNoteString = singleOrderArray[i]['measurementsObject']['notes'];
}

  if(singleOrderArray[i].manualSize && singleOrderArray[i].manualSize.imagePic){
    manualImageUrl = PicBaseUrl + singleOrderArray[i].manualSize.imagePic
    console.log("+++++", manualImageUrl)
  }else{
    manualImageUrl = PicBaseUrl3 + "images/manual/" + singleOrderArray[i].item_code.split(" ")[0].toLowerCase() + "_manual.png"
  }
  html = html + '<div class="wrapper" style="margin:10px; min-height:50vh; height:auto; page-break-after: always;">'+
      
  
  '<div class="inner-wraper w-100" style="border:1px solid;">'+
    '<div class="header-section" style="display: flex; justify-content: space-between; gap:20px; padding: 5px; border-bottom: 1px solid;">'+

      '<div class="info" style="flex: 20%;">'+

          '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.2rem">'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Name:</h5>'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize">'+ order.customerName +' </h5>'+
          '</div>'+

          '<div class="info-box" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
              
            '<div class="date-display" style="display: flex; gap: 20px;">'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">order Date:</h5>'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.OrderDate +' </h5>'+
            '</div>'+
          '</div>'+

          '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.2rem">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Quantity</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ (Number(i) + 1) + " OF " + singleOrderArray.length + 
            '</h5>'+
        '</div>'+

        '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Old Order :</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ oldOrderId + 
            '</h5>'+
            '</div>';
            if(order['order_status'] == "Modified"){
              html = html +
              
            '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
            '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:red">Modified on :' + 
            '</h5>'+ 
            '</h5>'+
            '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0">'+ new Date(order.date).toLocaleDateString() + 
            '</h5>'+
        '</div>';
            }
            html = html +
        '</div>'+

      '<div class="info" style="flex: 21%; text-align:center; display: flex; width: 100%; height: auto; gap: 20px; flex-wrap: wrap;">'+

          '<div class="gender">'+
            '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">Male</h5>'+
          '</div>'+

          '<div clas="info-box" style="border:1px solid #000000; flex: 50%; height:fit-content; padding: 2px 5px; display: flex;flex-direction:column;align-items: center;">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline; margin-bottom: 2px;">'+ order.orderId +'</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ orderType +'</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ groupOrderID +'</h5>'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize;">'+ (i + 1) + " " + singleOrderArray[i].item_name +'</h5>'+
          '</div>'+

          '<div class="total-quantiy">';
          for(let items of order['order_items']){
            html = html + 
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform: capitalize;">' + items['quantity'] + " " + items['item_name'] +'</h5>';
          }

          html = html +
          '</div>'+

      '</div>'+

      
    
      '<div class="info" style="flex: 20%; display: flex; gap:20px; justify-content: center;">'+
   

        '<div clas="info-box" style="text-align:center">'+
          '<img src=data:image/png;base64,'+qrImageBase64+' alt="logo" class="img-fluid" style="width:80px; object-fit: contain; object-position: 100% 100%;"><br><span style="font-size:.6rem; text-align:center">'+qrData+'</span>'+
        '</div>'+

               '<div clas="info-box" style="text-align:center">'+
            '<img src="'+ PicBaseUrl + retailer["retailer_logo"] +  '" alt="logo" class="img-fluid" style="width:80px; object-fit: contain; object-position: 100% 100%;">'+
        '</div>'+
      '</div>'+

    '</div>'+
  '<div class="second-page" style="display:grid; grid-template-columns: repeat(2,1fr); gap:10px;">'+
  
    '<div class="data-additional">'+
        '<div class="tabel-details">'+
          
          '<table class="table table-bordered" style="width:100%; border-collapse: collapse; border-spacing:0;">'+
          
              '<tbody>'+

                '<tr>'+
                  '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;border-bottom: 1px solid;"></td>'+
                  '<td style="text-align:center;  width: auto; Height: 15px !important;padding: 2px 0px !important;font-size: 15px; border-right: 1px solid;border-bottom: 1px solid;">skin<p style="margin: 0;margin-top: 5px; height: 10px !important; padding: 5px;border-top: 1px solid; ">นิ้ว</p></td>'+
                  '<td style="text-align:center;  width: auto; Height: 15px !important;padding: 2px 0px !important;font-size: 15px; border-right: 1px solid;border-bottom: 1px solid;">FIT<p style="margin: 0;margin-top: 5px; height: 10px !important; padding: 5px;border-top: 1px solid; ">(+)</p></td>'+
                  '<td style="text-align:center;  width: auto; Height: 15px !important;padding: 2px 0px !important;font-size: 15px; border-right: 1px solid;border-bottom: 1px solid;">TTL<p style="margin: 0;margin-top: 5px; height: 10px !important; padding: 5px;border-top: 1px solid; ">นิ้ว</p></td>'+
                  '<td style="text-align:center;  width: auto; Height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;border-bottom: 1px solid;"><p style="margin: 0;margin-top: 5px; height: 10px !important; padding: 5px; "></p></td>'+
                '</tr>';

                for(let measurement of Object.keys(singleOrderArray[i].measurementsObject.measurements)){
                  
                  let string = ""
                  if(draftMeasurementsObj && (draftMeasurementsObj[singleOrderArray[i]['item_name']] || draftMeasurementsObj[singleOrderArray[i]['item_code'].split(" ")[0]])){
                    if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i]['item_code'].split(" ")[0] == 'jacket'){
                      if(draftMeasurementsObj['jacket']['measurements'][measurement]['total_value'] !== singleOrderArray[i].measurementsObject.measurements[measurement]['total_value']){
                        string = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><style>svg{fill:#1f513a}</style><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/></svg>';
                      }
                    }else if(singleOrderArray[i]['item_name']== 'suit' && singleOrderArray[i]['item_code'].split(" ")[0] == 'pant'){
                      if(draftMeasurementsObj['pant']['measurements'][measurement]['total_value'] !== singleOrderArray[i].measurementsObject.measurements[measurement]['total_value']){
                        string = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><style>svg{fill:#1f513a}</style><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/></svg>';
                      }
                    }else if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i]['item_code'].split(" ")[0] == 'tuxedojacket'){
                      if(draftMeasurementsObj['tuxedojacket'] && draftMeasurementsObj['tuxedojacket']['measurements'][measurement]['total_value'] !== singleOrderArray[i].measurementsObject.measurements[measurement]['total_value']){
                        string = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><style>svg{fill:#1f513a}</style><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/></svg>';
                      }
                    }else if(singleOrderArray[i]['item_name']== 'tuxedo' && singleOrderArray[i]['item_code'].split(" ")[0] == 'pant'){
                      if(draftMeasurementsObj['pant'] && draftMeasurementsObj['pant']['measurements'][measurement]['total_value'] !== singleOrderArray[i].measurementsObject.measurements[measurement]['total_value']){
                        string = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><style>svg{fill:#1f513a}</style><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/></svg>';
                      }
                    }else{
                      if(draftMeasurementsObj[singleOrderArray[i]['item_name']]['measurements'][measurement]['total_value'] !== singleOrderArray[i].measurementsObject.measurements[measurement]['total_value']){
                        string = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><style>svg{fill:#1f513a}</style><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/></svg>';
                      }
                    }

                    
                  }

                  html = html + 
                  '<tr>'+
                    '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;border-bottom: 1px solid;">' + measurement + "[" + singleOrderArray[i].measurementsObject.measurements[measurement]['thai_name'] + ']</td>'+
                    '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;border-bottom: 1px solid;">' + singleOrderArray[i].measurementsObject.measurements[measurement]['value'] + '</td>'+
                    '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;border-bottom: 1px solid;">' + singleOrderArray[i].measurementsObject.measurements[measurement]['adjustment_value'] + '</td>'+
                    '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;border-bottom: 1px solid;">' + singleOrderArray[i].measurementsObject.measurements[measurement]['total_value'] + '</td>'+
                    '<td style="width: auto;height: 15px !important;padding: 2px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;border-bottom: 1px solid;">' + string + '</td>'+
                  '</tr>';
                }
                
                //width: auto; height: 40px; padding: 2px 5px; font-size: 15px; text-align: center; vertical-align: middle; border: 1px solid black;
                html = html + 
              '</tbody>'+

            '</table>'+
      '</div>'+
    '</div>'+
    
    '<div class="right-content">'+
      '<div class="featured-image" style="flex: 50%; margin-top: 10px;">'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Manual size : '+ fittingTypeString +'</h5>'+
        // '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ singleOrderArray[i]['measurementsObject']['fitting_type'] ? singleOrderArray[i]['measurementsObject']['fitting_type'] : "NA" +'</h5>'+
        // '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Inshape</h5>'+
          
        '<img src="'+ manualImageUrl +'" class="img-fluid" style="width: 600px;height:300px;">'+

      '</div>'+ 

      '<div class="content" style="width:100%; margin:.4rem 0;">'+
          
          '<table class="table table-bordered" style="width:100%; border-collapse: collapse;">'+
        
          '<tbody>'+
            '<tr>'+
            '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 1px solid;border-bottom: 1px solid; border-top: 1px solid;">Measurment Note:</td>'+
            '<td style="width: auto;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 0px; border-left: 1px solid; border-bottom: 1px solid;border-top: 1px solid;"">'+ measurementNoteString +'</td>'+
            '<td style="width: auto;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px solid; border-bottom: 1px solid;border-top: 1px solid;""></td>'+
          '</tr>';

        if(singleOrderArray[i]['measurementsObject']['shoulder_type']){
          html = html + 
          '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 1px solid; border-bottom: 1px solid; border-top: 1px solid;">Shoulder Type:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 0;  border-left: 1px solid;border-bottom: 1px solid;">'+ singleOrderArray[i]['measurementsObject']['shoulder_type'] +'</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;  border-left: 0px;border-bottom: 1px solid; border-top: 1px solid;"><img src="'+ PicBaseUrl3 +'ImagesFabric/jacket/' + singleOrderArray[i]['measurementsObject']['shoulder_type'] + '.png" style="width:50px; height:50px;object-fit:contain" class="img-fluid"></td>'+
        '</tr>';
        }
        else if(singleOrderArray[i]['measurementsObject']['pant_type']){
          html = html + 
          '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 1px solid; border-bottom: 1px solid; border-top: 1px solid;">Pant Type:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 0;  border-left: 1px solid;border-bottom: 1px solid;">'+ singleOrderArray[i]['measurementsObject']['pant_type'] +'</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid;  border-left: 0px;border-bottom: 1px solid; border-top: 1px solid;"><img src="'+ PicBaseUrl3 +'ImagesFabric/pants/' + singleOrderArray[i]['measurementsObject']['pant_type'] + '.png" style="width:50px; height:50px;object-fit:contain" class="img-fluid"></td>'+
        '</tr>';
        }
          
          html = html + 
          '</tbody>'+
          
          
          '</table>'+
      
      '</div>'+ 
      '<div class="inner-gabric-style" style="display:grid; grid-template-columns: repeat(3,1fr); gap:0px; margin: 0;">'+

      '<div class="fabric-note" style="width: auto;height:auto; min-height:10px; text-align:center; border: 1px solid #000000;">'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">FABRIC ผ้า'+
        '</h5>'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ fabricCode +
        '</h5>'+
        '</div>';

        if(singleOrderArray[i].item_code.split(" ")[0] !== "pant"  && singleOrderArray[i].item_code.split(" ")[0] !== "shirt"){
          html = html +
          '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">LINING ซับใน'+
          '</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ liningCode +
          '</h5>'+
    
        '</div>'+
    
        '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">PIPING '+
          '</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ pipingCode +
          '</h5>'+
    
        '</div>';
        }
    
    
      html = html +
        '</div>'+ 

   '</div>'+
  
  '</div>'+   

  

  '<div class="extra-infomation" style="display: flex; margin:10px ; align-items: center; gap:5px; border-top: 1px solid; padding:2px 0;justify-content: space-between;">';
  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket"){
    for(let proFea of productFeaturesObject['jacket']){
      for(let x of Object.keys(singleOrderArray[i]["styles"]["jacket"]["groupStyle"])){
        if (singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x+'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['thai_name'] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    }
  }
  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket"){
    for(let proFea of productFeaturesObject['jacket']){
      for(let x of Object.keys(singleOrderArray[i]["styles"]["jacket"]["style"])){
        if (singleOrderArray[i]["styles"]["jacket"]["style"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["jacket"]["style"][x]["image"] + '" style="width:100px; height:100px; object-fit:contain">'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["jacket"]["style"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['value'] +'</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['thai_name'] + '</h6>'+
          '</div>';
        }
      }
    }
  }
  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
    for(let proFea of productFeaturesObject['pant']){
      
      for(let x of Object.keys(singleOrderArray[i]["styles"]["pant"]["style"])){
        if (singleOrderArray[i]["styles"]["pant"]["style"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["pant"]["style"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['thai_name'] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["pant"]["style"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    
    }
  }
  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
    for(let proFea of productFeaturesObject['pant']){
      
      if(singleOrderArray[i]["styles"]["pant"].groupStyle){
      for(let x of Object.keys(singleOrderArray[i]["styles"]["pant"]["groupStyle"])){
        if (singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name']  + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    }
    }
  }

  // tux

  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket"){
    for(let proFea of productFeaturesObject['tuxedojacket']){
      if(singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"]){
        for(let x of Object.keys(singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"])){
          if (singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"][x]["additional"] == "false" && proFea == x) {
            html =html +
            '<div class="box" style="width:auto; text-align:center">'+
            '<h6 style="text-transform:capitalize; margin:2px">' + x+'</h6>'+
            '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"][x]["image"] + '" style="width:100px; height:100px;">'+
            '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"][x]['value'] + '</h6>'+
            '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["tuxedojacket"]["groupStyle"][x]['thai_name'] + '</h6>'+
            // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["jacket"]["groupStyle"][x]['value'] + '</h6>'+
            '</div>';
          }
        }
      }
      
    }
  }
  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket"){
    for(let proFea of productFeaturesObject['tuxedojacket']){
      for(let x of Object.keys(singleOrderArray[i]["styles"]["tuxedojacket"]["style"])){
        if (singleOrderArray[i]["styles"]["tuxedojacket"]["style"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["tuxedojacket"]["style"][x]["image"] + '" style="width:100px; height:100px; object-fit:contain">'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["jacket"]["style"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["tuxedojacket"]["style"][x]['value'] +'</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["tuxedojacket"]["style"][x]['thai_name'] + '</h6>'+
          '</div>';
        }
      }
    }
  }
  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
    for(let proFea of productFeaturesObject['pant']){
      
      for(let x of Object.keys(singleOrderArray[i]["styles"]["pant"]["style"])){
        if (singleOrderArray[i]["styles"]["pant"]["style"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["pant"]["style"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['thai_name'] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["pant"]["style"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    
    }
  }
  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
    for(let proFea of productFeaturesObject['pant']){
      
      if(singleOrderArray[i]["styles"]["pant"].groupStyle){
      for(let x of Object.keys(singleOrderArray[i]["styles"]["pant"]["groupStyle"])){
        if (singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x +'</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name']  + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    }
    }
  }

  else if(singleOrderArray[i]['item_name'] !== 'suit' && singleOrderArray[i]['item_name'] !== 'tuxedo'){
    for(let proFea of productFeaturesObject[singleOrderArray[i]['item_name']]){
      if(singleOrderArray[i]['styles'].groupStyle)
      {
        for(let x of Object.keys(singleOrderArray[i]['styles'].groupStyle)){
        if (singleOrderArray[i]["styles"]["groupStyle"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x + '</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["groupStyle"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["groupStyle"][x]["value"] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["groupStyle"][x]["thai_name"] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["groupStyle"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]["groupStyle"][x]["value"] + '</h6>'+
          '</div>';
        }
      }
    }
    }

    for(let proFea of productFeaturesObject[singleOrderArray[i]['item_name']]){
      for(let x of Object.keys(singleOrderArray[i]['styles'].style)){
        if (singleOrderArray[i]["styles"]["style"][x]["additional"] == "false" && proFea == x) {
          html =html +
          '<div class="box" style="width:auto; text-align:center">'+
          '<h6 style="text-transform:capitalize; margin:2px">' + x + '</h6>'+
          '<img src="'+ PicBaseUrl + singleOrderArray[i]["styles"]["style"][x]["image"] + '" style="width:100px; height:100px;">'+
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["style"][x]["value"] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["style"][x]["thai_name"] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["style"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]["style"][x]["value"] + '</h6>'+
          '</div>';
        }
      }
    }


  }
    html = html + 
    '</div>'+

  '</div>'+
'</div>';
html = html + 
  ' <div class="wrapper" style="margin:10px; min-height:80vh; height:auto; page-break-after: always;">'+
  
  '<div class="inner-wraper w-100" style="border:1px solid;">'+
  '<div class="header-section" style="display: flex; justify-content: space-between; gap:20px; padding: 10px; border-bottom: 1px solid;">'+

    '<div class="info" style="flex: 20%;">'+

        '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Name:</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize">'+ order.customerName +' </h5>'+
        '</div>'+

        '<div class="info-box" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
            
          '<div class="date-display" style="display: flex; gap: 20px;">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">order Date:</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.OrderDate +' </h5>'+
          '</div>'+
        '</div>'+

        '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Quantity</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ (Number(i) + 1) + " OF " + singleOrderArray.length + 
          '</h5>'+
      '</div>'+


  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Old Order :</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ oldOrderId + 
      '</h5>'+
      '</div>';
      if(order['order_status'] == "Modified"){
        html = html +
        
      '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
      '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:red">Modified on :' + 
      '</h5>'+
      '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:600; margin:0">'+ new Date(order.date).toLocaleDateString() + 
      '</h5>'+
  '</div>';
      }
      html = html +
  '</div>'+

    '<div class="info" style="flex: 21%; text-align:center; display: flex; width: 100%; height: auto; gap: 20px; flex-wrap: wrap;">'+

        '<div class="gender">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">Male</h5>'+
        '</div>'+

        '<div clas="info-box" style="border:1px solid #000000; flex: 50%; height:fit-content; padding: 2px 5px; display: flex;flex-direction:column;align-items: center;">'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline; margin-bottom: 2px;">'+ order.orderId +'</h5>'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ orderType +'</h5>'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">'+ groupOrderID +'</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize;">'+ (i + 1) + " " + singleOrderArray[i].item_name +'</h5>'+
        '</div>'+

        '<div class="total-quantiy">';
        for(let items of order['order_items']){
          html = html + 
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform: capitalize;">' + items['quantity'] + " " + items['item_name'] +'</h5>';
        }

        html = html +
        '</div>'+

    '</div>'+

    
  
    '<div class="info" style="flex: 20%; display: flex; gap:20px; justify-content: center;">'+
      '<div clas="info-box" style="text-align:center">'+
        '<img src=data:image/png;base64,'+qrImageBase64+' alt="logo" class="img-fluid" style="width:80px; object-fit: contain; object-position: 100% 100%;"><br><span style="font-size:.6rem; text-align:center">'+qrData+'</span>'+
      '</div>'+
         '<div clas="info-box" style="text-align:center">'+
          '<img src="' + PicBaseUrl + retailer["retailer_logo"] +  '" alt="logo" class="img-fluid" style="width:100px; height:80px; object-fit: contain; object-position: 100% 100%;">'+
      '</div>'+

    '</div>'+

  '</div>'+
  
  '<div class="fabric-details" style="width:100%; display:flex; align-items:center; justify-content:flex-start; flex-wrape:wrap; margin:1rem 0;">';


  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
    for(let x of Object.keys(singleOrderArray[i]["styles"]["pant"]["style"])){
      if (singleOrderArray[i]["styles"]["pant"]["style"][x]["additional"] == "true") {
        html = html + 
        
      '<div class="fabric-note" style="width: auto;height:50px; min-height:80px; text-align:center; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 10px 0; padding:5px; text-align:center;border-bottom: 1px solid;">'+ x + 
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px; 0 text-align:center;">'+ singleOrderArray[i]["styles"]['pant']["style"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]['pant']["style"][x]["value"] +
      '</h5>'+
      '</div>';
      }
    }
  }

  if(singleOrderArray[i]['item_name'] == 'tuxedo' && singleOrderArray[i].item_code.split(" ")[0] == "tuxedojacket"){
    for(let x of Object.keys(singleOrderArray[i]["styles"]["tuxedojacket"]["style"])){
      if (singleOrderArray[i]["styles"]["tuxedojacket"]["style"][x]["additional"] == "true") {
        html = html + 
        
      '<div class="fabric-note" style="width: auto;height:50px; min-height:80px; text-align:center; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 10px 0; padding:5px; text-align:center;border-bottom: 1px solid;">'+ x + 
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px; 0 text-align:center;">'+ singleOrderArray[i]["styles"]['tuxedojacket']["style"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]['tuxedojacket']["style"][x]["value"] +
      '</h5>'+
      '</div>';
      }
    }
  }

  if(singleOrderArray[i]['item_name'] !== 'suit' && singleOrderArray[i]['item_name'] !== 'tuxedo'){
    for(let x of Object.keys(singleOrderArray[i]['styles'].style)){
      if (singleOrderArray[i]["styles"]["style"][x]["additional"] == "true") {

        html = html + 
        
      '<div class="fabric-note" style="width: auto;height:50px; min-height:80px; text-align:center; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 10px 0; padding:5px; text-align:center;border-bottom: 1px solid;">'+ x + 
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px; 0 text-align:center;">'+ singleOrderArray[i]["styles"]["style"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]["style"][x]["value"] +
      '</h5>'+
      '</div>';
      }
    }
  }

  html = html +
  '</div>'+

  '<div class="second-page" style="display:grid; grid-template-columns: repeat(2,1fr); gap:0px; margin: 1rem 0;">'+
  
  '<div class="data-additional">'+
      '<div class="tabel-details" style="page-break-after: always;">';

        if(singleOrderArray[i].item_code.split(" ")[0] == "pant" || singleOrderArray[i].item_code.split(" ")[0] == "vest"){

        }else if(singleOrderArray[i].item_code.split(" ")[0] == "shirt" && singleOrderArray[i]["styles"]["monogram"] == undefined){
          html = html +
          '<table class="table table-bordered additional-fabric" style="width:400px; border-collapse: collapse; margin-right:2rem;">'+
          
            
          '<tbody>'+
          '<h5 style="margin: 0;text-align: center;border: 1px solid; border-bottom:0; width: 400px;border-left: 0;font-size: 14px;font-weight: 400;padding: 10px 0;">MONOGRAM / ชื่อย่อ</h5>'+
          '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0;border-bottom: 1px solid; border-top: 1px solid;">Position</td>'+
          '<td style="width: auto;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid; border-left: 1px solid; border-bottom: 1px solid;border-top: 1px solid;""> N/A </td>'+

        '</tr>'+
        '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Style:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;"> N/A </td>'+
         '</tr>'+

         '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Font Color:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;"> N/A </td>'+
         '</tr>'+

         '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Monogram Name :</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;"> N/A </td>'+
         '</tr>'+
        
        '</tbody>'+

            '</table>';
        }else{

          html = html +
          '<table class="table table-bordered additional-fabric" style="width:400px; border-collapse: collapse; margin-right:2rem;">'+
          
            
          '<tbody>'+
          '<h5 style="margin: 0;text-align: center;border: 1px solid; border-bottom:0; width: 400px;border-left: 0;font-size: 14px;font-weight: 400;padding: 10px 0;">MONOGRAM / ปก</h5>'+
          '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0;border-bottom: 1px solid; border-top: 1px solid;">Position</td>'+
          '<td style="width: auto;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid; border-left: 1px solid; border-bottom: 1px solid;border-top: 1px solid;"">'+ monogramPosition +'</td>'+

        '</tr>'+
        '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Style:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;">'+ monogramFont +'</td>'+
         '</tr>'+

         '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Font Color:</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;">'+ monogramColor +'</td>'+
         '</tr>'+

         '<tr>'+
          '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Monogram Name :</td>'+
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;">'+monogramTag +'</td>'+
         '</tr>'+
        
        '</tbody>'+

            '</table>';
        }
          
        html = html +   
      '</div>'+
    '</div>'+
    '<div class="fabric-data-style">'+

    '<div class="inner-gabric-style" style="display:grid; grid-template-columns: repeat(3,1fr); gap:0px; margin: 0;">'+

    '<div class="fabric-note" style="width: auto;height:auto; min-height:10px; text-align:center; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">FABRIC ผ้า'+
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ fabricCode +
      '</h5>'+

    '</div>';

    if(singleOrderArray[i].item_code.split(" ")[0] !== "pant"  && singleOrderArray[i].item_code.split(" ")[0] !== "shirt"){
      html = html +
      '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">LINING ซับใน'+
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ liningCode +
      '</h5>'+

    '</div>'+

    '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">PIPING '+
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ pipingCode +
      '</h5>'+

    '</div>';
    }


  html = html +
    '</div>'+

    '<div class="styling-note" style="border: 1px solid; padding:5px; min-height: 100px; width: 98%;; margin:1rem 0">'+
    '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-align:center; border-bottom:0px; width:100%;">Styling Note</h5>';

    if(singleOrderArray[i]['styles']['note']){
      html =html +
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px 0; text-align:center;border-top: 1px solid;">'+singleOrderArray[i]['styles']['note']+'</h5>';
    }else{
      html = html +
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px 0; text-align:center;border-top: 1px solid;">No Note</h5>';      
    } 
  
    html = html +
  '</div>'+

    '</div>'+
  
  '</div>'+   

  
  '</div>'+
'</div>';

  if(singleOrderArray[i]['styles']['referance_image']){
    html = html +
    '   <div class="second-page" style="margin:10px; min-height:80vh; height:auto; page-break-after: always;">'+
    // '<div style="text-align: center"> <h3> Customer Profile </h3> </div>'
        '<span style="text-align:center"><h3>'+ singleOrderArray[i]['item_code'] + ' (' + order.orderId + ')</h3></span>'+
    '<img src="' + PicBaseUrl + singleOrderArray[i]['styles']['referance_image'] +'" class="img-fluid" style="width:100%; height:80%; object-fit: contain; object-position: center center;">'+
    
    '</div>';
  }


}


// for(let i=0; i < singleOrderArray.length; i++){

  if(order['customer_id']['image']){
    html = html +
    '   <div class="second-page" style="margin:10px; min-height:80vh; height:auto; page-break-after: always;">'+
    '<span style="text-align:center"><h3>Customer Image</h3><span>'+
        
    '<img src="' + PicBaseUrl + order['customer_id']['image'] +'" class="img-fluid" style="width:100%; height:70%; object-fit: contain; object-position: center center;">'+
    
    '</div>';
  }
// }



// Convert QR code image to data URI
    const browser = await puppeteer.launch(
      {
        headless: 'new', 
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox'
      ]
      }
    )

    
    // const doc = new PDFDocument({ layout: 'landscape'});
    // doc.pipe(fs.createWriteStream('pdf/'+ order.orderId +'.pdf'));

    // doc.text(html)
    // doc.save()
    // doc.end()
    const page  = await browser.newPage()
    await page.setContent(html, { timeout: 60000, waitUntil: 'networkidle0' })
    await page.emulateMediaFeatures('screen')
    await page.pdf({
        path: 'pdf/'+ order.orderId +'.pdf',
        displayHeaderFooter: true,
        landscape: true,
        printBackground: true,
        headerTemplate: "<div/>",
        footerTemplate: "<div style=\"text-align: right;width: 297mm;font-size: 8px;\"><span style=\"margin-right: 1cm\"><span class=\"pageNumber\"></span> of <span class=\"totalPages\"></span></span></div>"
    })

    const pathToPDF = "pdf/" + order['orderId'] + ".pdf"
    readFile(order['orderId'])
    uploadFile(pathToPDF, order['orderId'])
    const updateOrder = await Order.findOneAndUpdate({orderId: order['orderId']}, {pdf: pathToPDF})
    
    res.json({
      message: "PDF generated successfully!",
      status: true
    })

  }catch(err){
    console.log(err)
    return res.json({
      message: err.message,
      status: false,
      data: null
    })
  }

})

router.post('/sendMail', auth, async(req, res) => {
  try{
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // use SSL
      auth: {
          user: 'sanjcreations@gmail.com',
          pass: 'ayluoprkxhholvgw'
      }
  });
  // let order = req.body.order;
  const order = await Order.find({ orderId: req.body.order }).populate("customer_id").populate("retailer_id")
  let htmldfs = '<div>'+
  '<div style="background-color: #26377C;width: 100%; text-align: center;">'+
  // '<img style="background-color: #26377C;" src="http://t1.gstatic.com/licensed-image?q=tbn:ANd9GcRPMKnq00NF_T7RusUNeLrSazRZM0S5O8_AOcw2iBTmYTxd3Q7uXf0sW41odpAKqSblKDMUMHGb8nZRo9g" alt="">'+
    '<img style="background-color: #26377C;" src="https://res.cloudinary.com/di5etqzhu/image/upload/v1682404348/siamsuitsadminlogo_b7zrfu.png" alt="">'+
  '</div>'+
  '<div style="width: 300px; flex-wrap: wrap; margin: 0 -15px;">'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Retailer Name: </p>'+
      '<p "style=width:100%;"> <b>'+ order[0]['retailerName'] + " (" + order[0]['retailer_code'] +')</b></p>'+
    '</div>'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Customer Name: </p>'+
      '<p "style=width:100%;"> <b>'+ order[0]['customer_id']['firstname'] + " " + order[0]['customer_id']['lastname'] +'</b></p>'+
    '</div>'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Order Number: </p>'+
      '<p "style=width:100%;"> <b>'+ order[0]['orderId']+'</b></p>'+
    '</div>'+
'</div>';
  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '<sanjcreations@gmail.com>', // sender address
    to: order[0]['retailer_id']['email_recipients'], // list of receivers
    subject: order[0]['orderId'], // Subject line
    text: "Siam suits", // plain text body
    html: htmldfs, // html body
       attachments: [
      {
          filename: req.body.order + '.pdf', // <= Here: made sure file name match
          path: path.join(__dirname, './../../pdf/'+req.body.order+'.pdf'), // <= Here
          contentType: 'application/pdf'
      }]
  });

    // if(err){

    // }else{
      fs.unlink('pdf/'+req.body.order+'.pdf', (err) => {
        if(!err){
          console.log("file removed from local")
        }
      })
    // }
    return res.json({
      status: true,
      message: "",
      data: null
    })
  }catch(err){

    console.log("error: ",  err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
  
})


// check pdf availibility=====================

router.post('/checkPdf', auth, async(req, res) => {
  try{
    const params = {
      Bucket: BucketName,
      Key: "pdf/" + req.body.pdf
    }
    s3.getObject(params, (err, data) => {
      if(!err){
        return res.json({
          data: null,
          status: true,
          message: "File Uploded"
        })
      }else{
        return res.json({
          data: null,
          status: false,
          message: "File not yet uploaded!"
        })
      }
    })
  }catch(err){
    return res.json({
      data: null,
      status: false,
      message: err.message
    })
  }
})



  const uploadFile = (filePath, filename) => {
  const fileContent = fs.readFileSync(filePath)
  const params = {
    Bucket: BucketName,
    Key: "pdf/" + filename,
    Body: fileContent,
    ContentType: "application/pdf"
  }
  s3.upload(params, (err, data) => {
    if(err){
      console.log(err.message)
    }else{
      // fs.unlink(filePath, (err) => {
      //   if(!err){
      //     console.log("file removed from local")
      //   }
      // })
      console.log("file uploaded: ", data.Location)
    }
  })
}

const deleteFile = (filename) => { 
  const params = {
    Bucket: BucketName,
    Key: "pdf/" + filename
  }
  s3.deleteObject(params, (err, data) => {
    if(err){
      console.log(err)
    }else{
      console.log("file deleted")
    }
  })
}

const readFile = (filename) => {
  const params = {
    Bucket: BucketName,
    Key: "pdf/" + filename
  }
  s3.getObject(params, (err, data) => {
    if(!err){
      console.log("file read")
      // deleteFile(filename)
    }
  })
}
module.exports = router