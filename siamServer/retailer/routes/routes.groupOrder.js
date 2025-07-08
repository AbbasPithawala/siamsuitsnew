const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const GroupOrder = require("../../retailer/model/model.groupOrder");
const Order = require("./../model/model.Order")
const Product = require("./../../admin/model/model.products")
const APIFeatures = require("../../utills/apiFeatures");
const catchAsync = require('../../utills/catchAsync');
const AppError = require('../../utills/appError');
const ShortUniqueId = require("short-unique-id");
const QRCode = require('qrcode');
const { findByIdAndUpdate } = require("../../admin/model/model.Admin");
const mongoose = require("mongoose");
const qr = require('qr-image');
const fs = require('fs');
const { default: puppeteer } = require('puppeteer');
const path = require('path');
const AWS = require("aws-sdk");
const slugify = require('slugify');

const KEY_ID = process.env.ACCESS_KEY;
const SECRET_ID = process.env.SECRET_KEY;
const BucketName = "siamsuits";
const nodemailer = require("nodemailer");

const s3 = new AWS.S3({
  accessKeyId: KEY_ID,
  secretAccessKey: SECRET_ID
})
const PicBaseUrl3 = require("./../../config")

var ObjectId = require('mongoose').Types.ObjectId; 
const PicBaseUrl = "https://siamsuits.s3.ap-northeast-1.amazonaws.com/images/";

const GroupOrderSerializer = data => ({
  _id: data._id,
  orderId: data.orderId,
  retailer_id: data.retailer_id,
  retailer_code: data.retailer_code,
  name: data.name,
  retailerName:data.retailerName,
  customer_quantity: data.customer_quantity,
  order_items: data.order_items,
  product_quantity: data.product_quantity,
  total_quantity: data.total_quantity,
  customer_quantity:data.customer_quantity,
  customers: data.customers,
  order_status: data.order_status,
  orderDate: data.orderDate,
  orderPlaced: data.orderPlaced,
  products: data.products,
  manualSize: data.manualSize,
  date: data.date,
  isCompleted:data.isCompleted

});

function toJSONLocal(date) {
  var local = new Date(date);
  local.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return local.toJSON().slice(0, 10);
}


router.post("/fetch", auth, async (req, res) => {
  try {

    const orders = await GroupOrder.find({ orderId: req.body.order_id })

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

router.post("/fetchAll", auth, async (req, res) => {
  try {

    const orders = await GroupOrder.find().sort('-date').populate("retailer_id")

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
    let updateOrder = await GroupOrder.findByIdAndUpdate(req.params.id, { order_status: req.body.order_status }, { new: true })
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

router.post("/fetchPaginate", auth, async (req, res) => {
  try {
    let page = req.query.page;
    let limit = req.query.limit;
    let order_status = req.query.order_status;
    let name = req.query.name;
    let retailerName = req.query.retailerName;
    let retailer_code = req.query.retailer_code;
    let orderDate = req.query.orderDate;
    let query = {};


    if (retailerName && retailerName !== "null") {  
      query = { retailerName: new RegExp(`${retailerName}+`, "i") }
    }

    if (retailer_code && retailer_code !== "null") {
      query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    }

    if (order_status && order_status !== "null") {
      query = { order_status: new RegExp(`${order_status}+`, "i") }
    }

    if (name && name !== "null") {
      query = { name: new RegExp(`${name}+`, "i") }
    }

    if (orderDate && orderDate !== "null") {
      query = { orderDate: new RegExp(`${orderDate}+`, "i") }
    }

    const paginated = await GroupOrder.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        // populate: "retailer_id",
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(GroupOrderSerializer));
    // console.log(data)

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

router.post("/fetchPaginateGroupCustomerOrders/:customer/:retailer", auth, async (req, res) => {
  console.log(new ObjectId(req.params.retailer))
  try {
    const groupOrders = await GroupOrder.find({retailer_id : req.params.retailer})

    console.log(groupOrders)
    if(groupOrders.length > 0){
      const newGroupOrderArray = groupOrders.filter((singles) => {
        return singles['customers'].includes(req.params.customer)
      })

      if(newGroupOrderArray.length > 0){
        return res.json({
          status: true,
          message: "Group Orders fetched successfully!",
          data: newGroupOrderArray
        });
      }else{
        return res.json({
          status: false,
          message: "This Customer does not belong to any group order!",
          data: null
        });
      }
    }else{
      return res.json({
        status: false,
        message: "No Group Orders for this retailer",
        data: null
      });
    }
  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    });
  }
});

router.post("/fetchAdminPaginateNew/:skip", auth, async(req, res) => {

  try{
    // const orders = await Order.find(req.body.par).limit(5).skip(req.params.skip).sort({date: -1})
    // const orders = await Order.find(req.body.par).sort({date: -1}).limit(5).skip(req.params.skip)
    const groupOrders = await GroupOrder.find(req.body.par).sort({date: -1}).limit(5).skip(req.params.skip)
    if(groupOrders.length < 1){
      return res.json({
        status: false,
        message: "No Orders Found",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Orders fetched successfully.!",
      data: groupOrders
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})

router.post("/fetchGroupOrder", auth, async (req, res) => {
  try {
    let page = req.query.page;
    let limit = req.query.limit;
    let retailer_code = req.query.retailer_code;
    let name = req.query.name;

    let query = {};

    if (retailer_code && retailer_code !== "null") {
      query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    }

    if (name && name !== "null") {
      query = { name: new RegExp(`${name}+`, "i") }
    }

    const paginated = await GroupOrder.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(GroupOrderSerializer));

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

router.post("/fetchDatag/:id", auth, async (req, res) => {
  try {
    const data = await GroupOrder.find({ _id: req.params.id }).populate('customers')
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




router.post("/create", auth, async (req, res) => {
  try {

    let priceObject = {};
    let stylingObject = {}
    for (let product of req.body.group.order_items){
      if(product['item_name'] == 'suit'){
        let i = 0;
        for(let items of Object.keys(product['styles'][0])){
          // console.log(items , " ", product['styles'][0][items])
          let price = {};
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let jacketPrice = 0
          if(product['styles'][0][items]['jacket']['style']){
              for(let styles of Object.keys(product['styles'][0][items]['jacket']['style'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['jacket']['style'][styles]['workerprice']) > 0){
                // console.og()
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
      }else if(product['item_name'] == 'tuxedo'){
        let i = 0;
        for(let items of Object.keys(product['styles'][0])){
          // console.log(items , " ", product['styles'][0][items])
          let price = {};
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let jacketPrice = 0
          if(product['styles'][0][items]['tuxedojacket']['style']){
              for(let styles of Object.keys(product['styles'][0][items]['tuxedojacket']['style'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice']) > 0){
                // console.og()
                stylingPriceObjectJacket[product['styles'][0][items]['tuxedojacket']['style'][styles]['value']] = Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice'])
              }
            }
           
          }
          if(product['styles'][0][items]['tuxedojacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['tuxedojacket']['groupStyle'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])
              if(Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectJacket[product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])
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
          priceObject["tuxedo_" + 'tuxedojacket' + "_" + i] = Number(jacketPrice)
          priceObject["tuxedo_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["tuxedo_" + 'tuxedojacket' + "_" + i] = stylingPriceObjectJacket
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

    const fetchExistingOrder = await GroupOrder.find({retailer_code: req.body.group.retailer_code});

    const groupNameSlug = slugify(req.body.group.name, {
      lower: true,      // Convert to lowercase
      strict: true,     // Remove special characters
      trim: true,        // Trim whitespace
      replacement: '_'
    });
    // i am just adding a comment to test
    if(fetchExistingOrder.length > 0){ 
      var order = new GroupOrder({
      orderId: `${req.body.group.retailer_code}-${groupNameSlug}-000${
                Number(
                  fetchExistingOrder[fetchExistingOrder.length - 1].orderId
                    .split('-')
                    .pop()            // grab the last piece (e.g., "00017")
                ) + 1
              }`,
      retailer_id: req.body.group.retailer_id,
      retailer_code: req.body.group.retailer_code,
      retailerName: req.body.group.retailerName,
      name: req.body.group.name,
      customer_quantity: req.body.group.customer_quantity,
      order_items: req.body.group.order_items,
      product_quantity: req.body.group.product_quantity,
      customers: req.body.group.customers,
      order_status: req.body.group.rushOrderDate ? "Rush" : "New Order",
      rushOrderDate: req.body.group.rushOrderDate ? req.body.order.rushOrderDate : "" ,
      stylingprice: stylingObject,
      workerprice: priceObject
    });
    }else{
      var order = new GroupOrder({
        orderId: `${req.body.group.retailer_code}-${groupNameSlug}-000${1}`,
        retailer_id: req.body.group.retailer_id,
        retailer_code: req.body.group.retailer_code,
        retailerName: req.body.group.retailerName,
        name: req.body.group.name,
        customer_quantity: req.body.group.customer_quantity,
        order_items: req.body.group.order_items,
        product_quantity: req.body.group.product_quantity,
        customers: req.body.group.customers,
        order_status: req.body.group.rushOrderDate ? "Rush" : "New Order",
        rushOrderDate: req.body.group.rushOrderDate ? req.body.order.rushOrderDate : "" ,
        workerprice: priceObject,
        stylingprice: stylingObject,
  
        // products: req.body.group.products
      });
    }
   

    await order.save();

    return res.json({
      status: true,
      message: "Create data successfully",
      data: order
    });

  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});

router.post("/updateProductStyle/:id", auth, async (req, res) => {
  try {
    let priceObject = {};
    let stylingObject = {}
    for (let product of req.body.group.order_items){
      
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
      }else if(product['item_name'] == 'tuxedo'){
        let i = 0;
        for(let items of Object.keys(product['styles'][0])){
          let price = {};
          let stylingPriceObjectJacket = {};
          let stylingPriceObjectPant = {};
          let pantPrice = 0;
          let jacketPrice = 0
          if(product['styles'][0][items]['tuxedojacket']['style']){
            for(let styles of Object.keys(product['styles'][0][items]['tuxedojacket']['style'])){
                jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice'])              
                if(Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice']) > 0){
                  stylingPriceObjectJacket[product['styles'][0][items]['tuxedojacket']['style'][styles]['value']] = Number(product['styles'][0][items]['tuxedojacket']['style'][styles]['workerprice'])
                }
            }           
          }
          if(product['styles'][0][items]['tuxedojacket']['groupStyle']){
                for(let styles of Object.keys(product['styles'][0][items]['tuxedojacket']['groupStyle'])){
              jacketPrice = Number(jacketPrice) + Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])

              if(Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice']) > 0){

                stylingPriceObjectJacket[product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['value']] = Number(product['styles'][0][items]['tuxedojacket']['groupStyle'][styles]['workerprice'])
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

          priceObject["tuxedo_" + 'tuxedojacket' + "_" + i] = Number(jacketPrice)
          priceObject["tuxedo_" + 'pant' + "_" + i] = Number(pantPrice)
          stylingObject["tuxedo_" + 'tuxedojacket' + "_" + i] = stylingPriceObjectJacket
          stylingObject["tuxedo_" + 'pant' + "_" + i] = stylingPriceObjectPant
          
          i = i + 1
        }
      }else{
        if(product['styles'][0]){
          for(let items of Object.keys(product['styles'][0])){
            const styleObj = {}
              let price = 0;
              if(product['styles'][0][items]['style']){
                  for(let styles of Object.keys(product['styles'][0][items]['style'])){
                    console.log("styles: ", styles)
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
        }else{
          for(let items of Object.keys(product['styles'])){
            const styleObj = {}
              let price = 0;
              if(product['styles'][items]['style']){
                  for(let styles of Object.keys(product['styles'][items]['style'])){
                    console.log("styles: ", styles)
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
    }

    const existData = await GroupOrder.findOne({_id: req.params.id}).lean();

    if (!existData) {
      return res.json({
        status: false,
        message: err.message,
        data: null
      })
    }
    const orders = await Order.updateMany(
      { groupOrderID: existData['_id'] }, // Filter condition
      { $set: { 
        order_items:  req.body.group.order_items,
        product_quantity: req.body.group.product_quantity,
        products: req.body.group.products,
        workerprice: priceObject,
        stylingprice: stylingObject,
      } } // Fields to update
    );

    if(!orders){
      return res.json({
        status: false,
        message: "Orders could not be updated!.",
        data: null
      })
    }

    const updateData = await GroupOrder.findByIdAndUpdate(
      req.params.id, 
       {
        name: req.body.group.name,
        product_quantity: req.body.group.product_quantity,
        order_items: req.body.group.order_items,
        products: req.body.group.products,
        customers: req.body.group.customers,
        customer_quantity: req.body.group.customer_quantity,
        workerprice: priceObject,
        stylingprice: stylingObject,
       },
      { new: true }
    )

    if (!updateData) {
      return res.json({
        status: false,
        message: "Group Order counld not be updated",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Success",
      // data: updateData
    });

  } catch (err) {
    console.log("error: ", err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});

router.post("/createGroupCustomers/:id", auth, async (req, res) => {

  try {
    const order = await GroupOrder.findByIdAndUpdate(
      req.params.id,
      {
        customers: req.body.arr_1
      },
      { new: true }
    );
    // console.log(order)

    return res.json({
      status: true,
      message: "Success",
      data: order.customers
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: []
    })

  }

});

router.post("/changeNumberOfCustomer/:id", auth, async (req, res) => {

  try {
    const order = await GroupOrder.findByIdAndUpdate(
      req.params.id,
      { $push : { "customers": req.body.arr_1 } },
      { new: true }
    );
    // console.log(order)

    return res.json({
      status: true,
      message: "Success",
      data: order.customers
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: []
    })

  }

});

router.post("/delteCustomer/:id/:customerId", auth, async (req, res) => {

  try {

    const data = await GroupOrder.findByIdAndUpdate(
      req.params.id,
      { $pull: { customers: { _id: req.params.customerId } } },
      { new: true }
    );

    const updateCustomerQuantity = await GroupOrder.findByIdAndUpdate(
      req.params.id, {
      customer_quantity: data.customers.length
    },
      { new: true }
    )


    return res.json({
      status: true,
      message: "Success",
      data: updateCustomerQuantity.customers,
      data2: updateCustomerQuantity
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: []
    })

  }

});

router.post("/updateCustomerDetails/:id/:customerId", auth, async (req, res) => {

  try {

    const data = await GroupOrder.findOneAndUpdate(
      { _id: req.params.id, "customers._id": req.params.customerId },
      { $set: { "customers.$": req.body.customer } },
      { new: true }
    );


    return res.json({
      status: true,
      message: "Data update successfully",
      data: data
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: []
    })

  }

});

router.post("/updateCustomerQuantity/:id", auth, async (req, res) => {
  try {

    const existData = await GroupOrder.findById(req.params.id);

    if (!existData) {
      return res.json({
        status: false,
        message: err.message,
        data: null
      })
    }
    const updateData = await GroupOrder.findByIdAndUpdate(
      req.params.id,
       {
        customer_quantity: req.body.customer_quantity
       },
      { new: true }
    )

    if (!updateData) {
      return res.json({
        status: false,
        message: err.message,
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Success",
      data: updateData.customer_quantity
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});


// router.post("/updateCustomerProductMeasurement/:id/:customerId", auth, async (req, res) => {

//   try {

//     const data = await GroupOrder.findOneAndUpdate(
//       { _id: req.params.id, "customers._id": req.params.customerId },
//       { $set: { "customers.$.measurementsObject": req.body.measurementsObject } },
//       { new: true }
//     );


//     return res.json({
//       status: true,
//       message: "Data update successfully",
//       data: data
//     });

//   } catch (err) {
//     return res.json({
//       status: false,
//       message: err.message,
//       data: []
//     })

//   }

// });
 
router.post("/fetchGroupCustomer/:id/:customerId", auth, async (req, res) => {

  try {
    const data = await GroupOrder.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(req.params.id) } },
      { $unwind: '$customers' },
      { $match: { 'customers._id': mongoose.Types.ObjectId(req.params.customerId) } }
    ]);

    return res.json({
      status: true,
      message: "Success",
      data: data
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: []
    })

  }

});

router.post("/placeGroupOrder/:id", auth, catchAsync(async (req, res, next) => {

  try{
    const products = await Product.find()

    let date = new Date();
  
    const existData = await GroupOrder.findOne({_id: req.params.id}).lean();
  
    if (!existData) {
      return next(new AppError('No document found', 404));
    }



  
    const processObject = {}
    // const processObject = {}
    // for (let x of products){
    //   processObject[x['name']] = x['process']
    // } 
    // let productProcessObject = {}
    // let manufacturingObject = {}
    // for(let x of existData.order_items){
    //   if(x['item_name'] == 'suit'){
    //     productProcessObject['jacket'] = {}
    //     for(let m of processObject['jacket']){
    //       const obj = {}     
    //       obj['status'] = 0;
    //       obj['tailer_id'] = "";  
    //       if(Object.keys(productProcessObject).length > 0){
    //         productProcessObject['jacket'][m] = obj
    //       }else{
    //         productProcessObject['jacket'] = {
    //           m: obj
    //         }
    //       }
          
    //      }
         
    //     productProcessObject['pant'] = {}
    //      for(let m of processObject['pant']){
    //       const obj = {}     
    //       obj['status'] = 0;
    //       obj['tailer_id'] = "";  
    //       if(Object.keys(productProcessObject).length > 0){
    //         productProcessObject['pant'][m] = obj
    //       }else{
    //         productProcessObject['pant'] = {
    //           m: obj
    //         }
    //       }
          
    //      }
        
    //      for(let customer of existData.customers){   
    //       const customerObject = {}    
    //       for(let i =0; i < x['quantity']; i++){
    //         customerObject[x['item_name']+"_jacket_"+i] = productProcessObject['jacket']
    //         customerObject[x['item_name']+"_pant_"+i] = productProcessObject['pant']
    //       } 
    //       manufacturing[customer] = customerObject
    //     }
    //   }else{
    //     productProcessObject[x['item_name']] = {}
    //     for(let m of processObject[x['item_name']]){
    //       const obj = {}     
    //       obj['status'] = 0;
    //       obj['tailor_id'] = "";  
    //       if(Object.keys(productProcessObject).length > 0){
    //         productProcessObject[x['item_name']][m] = obj
    //       }else{
    //         productProcessObject[x['item_name']] = {
    //           m: obj
    //         }
    //       }          
    //      }
    //      for(let customer of existData.customers){   
    //       const customerObject = {}    
    //       for(let i =0; i < x['quantity']; i++){
    //         customerObject[x['item_name']+"_"+i] = productProcessObject[x['item_name']]
    //       }  
    //       manufacturing[customer] = customerObject
    //      }  
    //   }
      
    // }
  
    // const products = await Product.find()
      for (let x of products){
        processObject[x['name']] = x['process']
      }
   
      let productProcessObject = {}
      let manufacturingObject = {}
      for(let x of existData.order_items){
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
            manufacturingObject[x['item_name']+"_jacket_"+i] = productProcessObject['jacket']
            manufacturingObject[x['item_name']+"_pant_"+i] = productProcessObject['pant']
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
            manufacturingObject[x['item_name']+"_tuxedojacket_"+i] = productProcessObject['tuxedojacket']
            manufacturingObject[x['item_name']+"_pant_"+i] = productProcessObject['pant']
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
              manufacturingObject[x['item_name']+"_"+i] = productProcessObject[x['item_name']]
            }    
        }
        
      }
      let manufacturing = manufacturingObject


      const fetchExistingOrder = await Order.find({ retailer_code: req.body.order.retailer_code })
    

      let orderNumber = 0;
  
      if(fetchExistingOrder.length > 0){
        orderNumber =  Number(
          fetchExistingOrder[fetchExistingOrder.length - 1].orderId
            .split('-')
            .pop()          // take the LAST segment after the final “-”
        ) + 1
      }else{
        orderNumber= 1
      }


      const ordersArray = []
      if(req.body.order.customers.length > 0){
        for(let i = 0; i < req.body.order.customers.length; i++){
          const order = {
            orderId: `${req.body.order.retailer_code}-000${orderNumber}`,
            customerName: `${req.body.order.customers[i]['firstname']} ${req.body.order.customers[i]['lastname']}`,
            retailerName: req.body.order.retailerName,
            retailer_id: req.body.order.retailer_id,
            retailer_code: req.body.order.retailer_code,
            customer_id: req.body.order.customers[i]['_id'],
            measurements: req.body.order.customers[i]['measurementsObject'],
            Suitmeasurements: req.body.order.customers[i]['suit'],
            Tuxedomeasurements: req.body.order.customers[i]['tuxedo'],
            order_items: req.body.order.order_items,
            total_quantity: req.body.order.product_quantity,
            order_status: req.body.order.rushOrderDate ? "Rush" : "New Order",
            manufacturing: manufacturing,
            workerprice: existData.workerprice,
            stylingprice: existData['stylingprice'],
            rushOrderDate: req.body.order.rushOrderDate,
            OrderDate: toJSONLocal(date),
            type: "group",
            groupOrderID: existData['_id'],
            date: Date.now()
          };
  
          ordersArray.push(order)
          orderNumber = orderNumber + 1;
        }
      }

    
      const newOrders = await Order.insertMany(ordersArray)
      .then((docs) => console.log("Inserted:", docs))
      .catch((err) => console.error("Error:", err));
  
    const placeOrder = await GroupOrder.findByIdAndUpdate(
      req.params.id,
      {
        orderDate: req.body.orderDate || date.toLocaleDateString("es-CL"),
        date: Date.now(),
        isCompleted: true,
        manufacturing: manufacturing,
        orderPlaced: true
      },
      { new: true }
    );
  
    if (!placeOrder) {
      return next(new AppError("Failed Process", 404));
    }
  
    res.status(200).json({
      status: 'success',
      data: placeOrder
    });
  }catch(err){
    console.log(err)
  }
  

}));

router.post("/deleteGroupOrder/:id", auth, async (req, res) => {

  try {

    const data = await GroupOrder.findByIdAndDelete(
      req.params.id,
      { new: true }
    );

    return res.json({
      status: true,
      message: "Delete successfully",
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message
    })

  }

});

router.post("/createPdf", auth, async(req, res) => {
  try{


const orderItemsArrayPDF = JSON.parse(req.body.orderItemsArray)
const singleOrderArray = JSON.parse(req.body.singleOrderArray)
const productFeaturesObject = JSON.parse(req.body.productFeaturesObject)
const order = JSON.parse(req.body.order)
const retailer = JSON.parse(req.body.retailer)
const draftMeasurementsObj = req.body.draftMeasurementsObj ? JSON.parse(req.body.draftMeasurementsObj) : null
// const oldOrder = await GroupOrder.find({ customer_id: order['customer_id']._id }).sort({date: -1}).populate('customer_id').populate('retailer_id')
const oldOrder = []

let repeatOrderId = "No";
if(order['repeatOrder'] == true){
  const repeatOrder = await GroupOrder.find({ _id: order['repeatOrderID'] }).populate('customer_id').populate('retailer_id')
  if(repeatOrder.length > 0){
    repeatOrderId = repeatOrder[0]['orderId']
  }
}

let oldOrderId = "None";

if(oldOrder.length > 1){
  oldOrderId = oldOrder[1]['orderId']
}


const qrDataIndex = order['orderId']
const qrImageIndex = qr.imageSync(qrDataIndex, { type: 'png' });
const qrImageBase64Index = qrImageIndex.toString('base64');

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
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-transform:capitalize">'+ order.customerName +' </h5>'+
                  '</div>'+

                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Date:</h5>'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.orderDate +' </h5>'+
                      '<span style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; position:absolute; right:0; text-transform:uppercase">'+ order['customer_id']['gender'] +'</span>'+
                  '</div>'+

                  // '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                  //     '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">OLD ORDER NO:</h5>'+
                  //     '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+oldOrderId +
                  //     '</h5>'+
                  // '</div>'+

                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Old Order:</h5>'+
                      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+oldOrderId +
                      '</h5>'+
                  '</div>';
                  if(order['order_status'] == "Modified"){
                    html = html +
                    
                  '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
                  '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:green">Modified on :' + 
                  '</h5>'+ 
                  '</h5>'+
                  '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ new Date(order.date).toLocaleDateString() + 
                  '</h5>'+
              '</div>';
                  }
                  html = html +
              '</div>'+

              '<div class="info" style="border:1px solid #000000;flex: 23%; text-align:center">'+
                   '<div clas="info-box">'+
                   '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+ order.orderId + "-" + order['customer_id']['firstname'] + " " + order['customer_id']['lastname']+'</h5>'+
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
                      qrData = order.orderId + "/"+'suit_' + singles.item_code.split(" ")[0] + "_" + Number(singles.item_code.split(" ")[1]-1) + "/" + order['customer_id']['_id'];
                    }else{
                      qrData = order.orderId + "/" + singles.item_code.split(" ")[0] + "_" + Number(singles.item_code.split(" ")[1]-1) + "/" + order['customer_id']['_id'];
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
                    }else{

                      html =  html +        
                      '<tr>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+ singles.item_name + '</td>'+
                        '<td style="text-transform: capitalize; border-right: 1px solid; width: 25%; height: 50px; text-align: center; border-bottom: 1px solid; font-size:1.3rem; padding: 5px;">'+singles.item_code+'</td>'+
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

  // const qrData = order.orderId + "/" + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-0) + "/" + order['customer_id']['_id'];


  let itemName = "";
  let qrData = "";
  if(singleOrderArray[i].item_name == 'suit'){
    qrData = order.orderId + "/"+'suit_' + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-1) + "/" + order['customer_id']['_id'];
  }else{
    qrData = order.orderId + "/" + singleOrderArray[i].item_code.split(" ")[0] + "_" + Number(singleOrderArray[i].item_code.split(" ")[1]-1) + "/" + order['customer_id']['_id'];
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
  }

  let pipingCode = "N/A";
  if(singleOrderArray[i]['styles']['piping']){
    pipingCode = singleOrderArray[i]['styles']['piping']
  }else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']){
    pipingCode = singleOrderArray[i]['styles'][singleOrderArray[i].item_code.split(" ")[0]]['piping']
  }

  // monogram details

  let monogramPosition = "";
  let monogramColor= "";
  let monogramFont= "";
  let monogramTag=""

  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]["styles"]["jacket"]["monogram"] !== undefined){
    monogramColor = singleOrderArray[i]['styles']['jacket']['monogram']['color'] || "N/A"
    monogramFont = singleOrderArray[i]['styles']['jacket']['monogram']['font'] || "N/A"
    monogramPosition = singleOrderArray[i]['styles']['jacket']['monogram']['side'] || "Right Side"
    // monogramTag = singleOrderArray[i]['styles']['jacket']['monogram']['tag'] || "N/A"
    monogramTag = order['customer_id']['tag'] || "N/A"
  } else if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket" && singleOrderArray[i]["styles"]["jacket"]["monogram"] == undefined){
    monogramColor = "N/A"
    monogramFont = "N/A"
    monogramPosition = "Right Side" 
    monogramTag ="N/A"
  }else if(singleOrderArray[i]['item_name'] !== 'suit' && singleOrderArray[i]["styles"]["monogram"] !== undefined){
    if(singleOrderArray[i]['item_name'] == 'jacket'){
      monogramColor = singleOrderArray[i]['styles']['monogram']['color'] || "N/A"
      monogramFont = singleOrderArray[i]['styles']['monogram']['font'] || "N/A"
      monogramPosition = singleOrderArray[i]['styles']['monogram']['side'] || "Right Side" 
      monogramTag = order['customer_id']['tag'] || "N/A" 
      // monogramTag = singleOrderArray[i]['styles']['monogram']['tag'] || "N/A"
    }else{
      monogramColor = singleOrderArray[i]['styles']['monogram']['color'] || "N/A"
      monogramFont = singleOrderArray[i]['styles']['monogram']['font'] || "N/A"
      monogramPosition = singleOrderArray[i]['styles']['monogram']['side'] || "N/A"
      // monogramTag = singleOrderArray[i]['styles']['monogram']['tag'] || "N/A"
      monogramTag = order['customer_id']['tag'] || "N/A"
    }
  }else if(singleOrderArray[i]['item_name'] !== 'suit' && singleOrderArray[i]["styles"]["monogram"] == undefined){
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

// console.log(singleOrderArray[i]['measurementsObject'])

  if(singleOrderArray[i].manualSize && singleOrderArray[i].manualSize.imagePic){
    manualImageUrl = PicBaseUrl + singleOrderArray[i].manualSize.imagePic
  }else{
    manualImageUrl = PicBaseUrl3 + "images/manual/" + singleOrderArray[i].item_code.split(" ")[0].toLowerCase() + "_manual.png"
  }
  html = html + '<div class="wrapper" style="margin:10px; min-height:50vh; height:auto; page-break-after: always;">'+
      
  
  '<div class="inner-wraper w-100" style="border:1px solid;">'+
    '<div class="header-section" style="display: flex; justify-content: space-between; gap:20px; padding: 5px; border-bottom: 1px solid;">'+

      '<div class="info" style="flex: 20%;">'+

          '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.2rem">'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Name:</h5>'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.customerName +' </h5>'+
          '</div>'+

          '<div class="info-box" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
              
            '<div class="date-display" style="display: flex; gap: 20px;">'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">order Date:</h5>'+
              '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.orderDate +' </h5>'+
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
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:green">Modified on :' + 
            '</h5>'+ 
            '</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ new Date(order.date).toLocaleDateString() + 
            '</h5>'+
        '</div>';
            }

            if(order['order_status'] == "Rush"){
              html = html +
              
            '<div class="info-box" style="display: flex; gap: 20px; align-items: center; margin-bottom:.5rem">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:green">Rush Order :' + 
            '</h5>'+ 
            '</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order['rushOrderDate'] + 
            '</h5>'+
        '</div>';
            }

            html = html +
        '</div>'+

      '<div class="info" style="flex: 21%; text-align:center; display: flex; width: 100%; height: auto; gap: 20px; flex-wrap: wrap;">'+

          '<div class="gender">'+
            '<h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">Male</h5>'+
          '</div>'+

          '<div clas="info-box" style="border:1px solid #000000;flex: 50%; height: 60px; display: flex; flex-direction:column;align-items: center; justify-content: center;">'+
              '<div><h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+ order.orderId + '</h5></div>'+
              '<div><h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+order['customer_id']['firstname'] + " " + order['customer_id']['lastname']+ '</h5></div>' +
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
            '<img src="' + PicBaseUrl  + retailer["retailer_logo"] +  '" alt="logo" class="img-fluid" style="width:80px; object-fit: contain; object-position: 100% 100%;">'+
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
                  // console.log(singleOrderArray[i].measurementsObject.measurements)
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

                html = html + 
              '</tbody>'+

            '</table>'+
      '</div>'+
    '</div>'+
    
    '<div class="right-content">'+
      '<div class="featured-image" style="flex: 50%; margin-top: 10px;">'+
        '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">Manual size : '+ fittingTypeString +'</h5>'+
          
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

        if(singleOrderArray[i].item_code.split(" ")[0] !== "pant" && singleOrderArray[i].item_code.split(" ")[0] !== "shirt"){
          html = html +
          '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">LINING ซับใน'+
          '</h5>'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:2px 0 0px 0; padding:5px; 0 text-align:center;">'+ liningCode +
          '</h5>'+
    
        '</div>'+
    
        '<div class="fabric-note" style="width: auto; text-align:center; height:auto; min-height:10px; border: 1px solid #000000;">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">PIPING ท่อ'+
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
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['value'] + '</h6>'+
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['thai_name']  + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["jacket"]["style"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["jacket"]["style"][x]['value'] + '</h6>'+
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
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["style"][x]['thai_name'] +  '</h6>'+
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
          '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name'] + '</h6>'+
          // '<h6 style="text-transform:capitalize; margin:2px">' + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['thai_name'] + "/" + singleOrderArray[i]["styles"]["pant"]["groupStyle"][x]['value'] + '</h6>'+
          '</div>';
        }
      }
    }
    }
  }

  else if(singleOrderArray[i]['item_name'] !== 'suit'){
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
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["groupStyle"][x]["thai_name"]  + '</h6>'+
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
          '<h6 style="text-transform:capitalize; margin:2px">'+ singleOrderArray[i]["styles"]["style"][x]["thai_name"] +'</h6>'+
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
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.customerName +' </h5>'+
        '</div>'+

        '<div class="info-box" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: center; margin-bottom:.5rem; position:relative;">'+
            
          '<div class="date-display" style="display: flex; gap: 20px;">'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">order Date:</h5>'+
            '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ order.orderDate +' </h5>'+
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
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:600; margin:0; color:green">Modified on :' + 
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0">'+ new Date(order.date).toLocaleDateString() + 
      '</h5>'+
  '</div>';
      }
      html = html +
  '</div>'+

    '<div class="info" style="flex: 21%; text-align:center; display: flex; width: 100%; height: auto; gap: 20px; flex-wrap: wrap;">'+

        '<div class="gender">'+
          '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0;">Male</h5>'+
        '</div>'+

        '<div clas="info-box" style="border:1px solid #000000; flex: 50%; height: 60px; display: flex;flex-direction:column;align-items: center; justify-content: center;">'+
        '<div><h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+ order.orderId + '</h5></div>'+
        '<div><h5 style="font-size:15px; font-family:Montserrat,sans-serif; font-weight:400; margin:0; text-decoration: underline;">'+order['customer_id']['firstname'] + " " + order['customer_id']['lastname']+ '</h5></div>'+
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
          '<img src="' + PicBaseUrl  + retailer["retailer_logo"] +  '" alt="logo" class="img-fluid" style="width:100px; height:80px; object-fit: contain; object-position: 100% 100%;">'+
      '</div>'+

    '</div>'+

  '</div>'+
  
  '<div class="fabric-details" style="width:100%; display:flex; align-items:center; justify-content:flex-start; flex-wrape:wrap; margin:1rem 0;">';


  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "pant"){
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

  if(singleOrderArray[i]['item_name'] == 'suit' && singleOrderArray[i].item_code.split(" ")[0] == "jacket"){
    for(let x of Object.keys(singleOrderArray[i]["styles"]["jacket"]["style"])){
      if (singleOrderArray[i]["styles"]["jacket"]["style"][x]["additional"] == "true") {
        html = html + 
        
      '<div class="fabric-note" style="width: auto;height:50px; min-height:80px; text-align:center; border: 1px solid #000000;">'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 10px 0; padding:5px; text-align:center;border-bottom: 1px solid;">'+ x + 
      '</h5>'+
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:10px 0 0px 0; padding:5px; 0 text-align:center;">'+ singleOrderArray[i]["styles"]['jacket']["style"][x]["thai_name"] +"/" + singleOrderArray[i]["styles"]['jacket']["style"][x]["value"] +
      '</h5>'+
      '</div>';
      }
    }
  }

  if(singleOrderArray[i]['item_name'] !== 'suit'){
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

        if(singleOrderArray[i].item_code.split(" ")[0] == "pant" || singleOrderArray[i].item_code.split(" ")[0] == "vest" || singleOrderArray[i].item_code.split(" ")[0] == "shirt"){

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
          '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;">' + monogramTag +'</td>'+
         '</tr>'+

         
        //  '<tr>'+
        //   '<td style="width: 150px;height: 15px !important;padding: 8px 5px !important;font-size: 15px;text-align: left;border-right: 1px solid; border-left: 0px; border-bottom: 1px solid; border-top: 1px solid;">Options :</td>'+
        //   '<td style="width: auto;height: 15px !important; padding: 8px 5px !important;font-size: 15px;text-align: center;border-right: 1px solid;  border-left: 1px solid;border-bottom: 1px solid;">'+monogramTag +'</td>'+
        //  '</tr>'+
        
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
      '<h5 style="font-size:12px; font-family:Montserrat,sans-serif; font-weight:400; margin:0 0 2px 0; padding:5px; text-align:center;border-bottom: 1px solid;">PIPING ท่อ'+
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
  '   <div class="wrapper" style="margin:10px; min-height:100vh; height:auto; page-break-after: always;">'+
  '<span style="text-align:center"><h3 style="text-transform:capitalize">'+ singleOrderArray[i]['item_code']+ ' (' + order.orderId + ')</h3></span>'+
      
  '<img src="' + PicBaseUrl + singleOrderArray[i]['styles']['referance_image'] +'" class="img-fluid" style="width:600px; height:600px; object-fit: cover; object-position: center center;">'+
  
  '</div>';
}


}

if(order['customer_id']['image']){
  html = html +
  '   <div class="second-page" style="margin:10px; min-height:80vh; height:auto; page-break-after: always;">'+
  '<span style="text-align:center"><h3>Customer Image</h3><span>'+
      
  '<img src="' + PicBaseUrl + order['customer_id']['image'] +'" class="img-fluid" style="width:100%; height:70%; object-fit: contain; object-position: center center;">'+
  
  '</div>';
}
// for(let i=0; i < singleOrderArray.length; i++){

//   if(singleOrderArray[i]['styles']['referance_image']){
//     html = html +
//     '   <div class="wrapper" style="margin:10px; min-height:100vh; height:auto; page-break-after: always;">'+
        
//     '<img src="' + PicBaseUrl + singleOrderArray[i]['styles']['referance_image'] +'" class="img-fluid" style="width:100%; height:100%; object-fit: cover; object-position: center center;">'+
    
//     '</div>';
//   }
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

  const page  = await browser.newPage()

  await page.setContent(html)

  await page.emulateMediaFeatures('screen')

  await page.pdf({
    path: 'pdf/'+ order['orderId']+ "-"+order['customer_id']['firstname']+ "-"+order['customer_id']['lastname'] +'.pdf',
    displayHeaderFooter: true,
    landscape: true,
    printBackground: true,
    headerTemplate: "<div/>",
    footerTemplate: "<div style=\"text-align: right;width: 297mm;font-size: 8px;\"><span style=\"margin-right: 1cm\"><span class=\"pageNumber\"></span> of <span class=\"totalPages\"></span></span></div>"
  })
  let pdfObject = {}
  if(order['pdf']){
    pdfObject = order['pdf'];
  }
    
  pdfObject[order['customer_id']['_id']] = "pdf/" + order['orderId']+ "-"+order['customer_id']['firstname']+ "-"+order['customer_id']['lastname'] + ".pdf";
  const pathToPDF = "pdf/" + order['orderId']+ "-"+order['customer_id']['firstname']+ "-"+order['customer_id']['lastname'] + ".pdf";
  readFile(order['customer_id']['firstname']+ "-"+order['customer_id']['lastname'])
  uploadFile(pathToPDF, order['orderId']+ "-"+order['customer_id']['firstname']+ "-"+order['customer_id']['lastname'])
  
  const updateOrder = await GroupOrder.findOneAndUpdate({orderId: order['orderId']}, {pdf: pdfObject})
  // s3.  
  res.json({
    message: "PDF generated successfully!",
    status: true
  })

  }catch(err){
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
  const order = await GroupOrder.find({ _id: req.body.order }).populate("customers").populate("retailer_id")
  let htmldfs = '<div>'+
  '<div style="background-color: #26377C;width: 100%; text-align: center;">'+
  // '<img style="background-color: #26377C;" src="http://t1.gstatic.com/licensed-image?q=tbn:ANd9GcRPMKnq00NF_T7RusUNeLrSazRZM0S5O8_AOcw2iBTmYTxd3Q7uXf0sW41odpAKqSblKDMUMHGb8nZRo9g" alt="">'+
    '<img style="background-color: #26377C;" src="https://res.cloudinary.com/di5etqzhu/image/upload/v1682404348/siamsuitsadminlogo_b7zrfu.png" alt="">'+
  '</div>'+
  '<div style="width: 300px; flex-wrap: wrap; margin: 0 -15px;">'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Retailer Name: &nbsp;</p>'+
      '<p "style=width:100%;"> <b>'+ ' '+ order[0]['retailerName'] + " (" + order[0]['retailer_code'] +')</b></p>'+
    '</div>'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Group Order Name: &nbsp;</p>'+
      '<p "style=width:100%;"> <b> '+ ' ' + order[0]['orderId']+'</b></p>'+
    '</div>'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Total Customers: &nbsp;</p>'+
      '<p "style=width:100%;"> <b> '+ ' '+ order[0]['customers'].length+'</b></p>'+
    '</div>'+
    '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Products: &nbsp;</p>'+ ' ';

      for(let x of order[0]['order_items']){
        htmldfs = htmldfs + '<p "style=width:100%; text-transform:capitalize"> <b style="text-transform:capitalize"> ' + x['quantity'] + ' ' + x['item_name'] + '&nbsp;</b></p>';
      }
      htmldfs = htmldfs +
    '</div>';

    for(let x = 0; x < order[0]['customers'].length; x++){
      let i = Number(x) + 1;
      htmldfs = htmldfs +
      '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
      '<p "style=width:100%;">Customer '+ i +': &nbsp;</p>'+
      '<p "style=width:100%; text-transform: capitalize;"> <b> '+ '   '+ order[0]['customers'][x]['firstname']+ ' ' + order[0]['customers'][x]['lastname'] + '&nbsp;</b></p>'+
    '</div>';
    }
    // '<div style="display:inline-flex; width: 100%; margin-bottom: 10px; padding:0 15px">'+
    //   '<p "style=width:100%;">Customer Name: </p>'+
    //   '<p "style=width:100%;"> <b>'+ order[0]['customer_id']['firstname'] + " " + order[0]['customer_id']['lastname'] +'</b></p>'+
    // '</div>'+
    htmldfs = htmldfs +
'</div>';
  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '<abbaspithawala098@gmail.com>', // sender address
    to: order[0]['retailer_id']['email_recipients'], // list of receivers
    subject: order[0]['orderId'], // Subject line
    text: "Siam Suits", // plain text body
    html: htmldfs, // html body
      //  attachments: [
      // {
      //     filename: req.body.order+ '.pdf', // <= Here: made sure file name match
      //     path: path.join(__dirname, './../../pdf/'+req.body.order+'.pdf'), // <= Here
      //     contentType: 'application/pdf'
      // }]
  });

    // if(err){

    // }else{
      // fs.unlink('pdf/'+req.body.order+'.pdf', (err) => {
      //   if(!err){
      //     console.log("file removed from local")
      //   }
      // })
    // }
    return res.json({
      status: true,
      message: "",
      data: null
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
      console.log(err)
    }else{
      fs.unlink(filePath, (err) => {
        if(!err){
          console.log("file removed from local")
        }
      })
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
      deleteFile(filename)
    }
  })
}
module.exports = router;



