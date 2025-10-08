const express = require("express");
const router = express.Router();
const Tailor = require("../../model/factoryModel/model.tailor");
const auth = require("../../../middleware/auth");
const APIFeatures = require("../../../utills/apiFeatures");
const catchAsync = require('../../../utills/catchAsync');
const AppError = require('../../../utills/appError');
const mongoose = require("mongoose");
const Order = require("../../../retailer/model/model.Order");
const GroupOrder = require("../../../retailer/model/model.groupOrder");
const Jobs = require("./../../model/factoryModel/model.jobs");
const ExtraPaymentCategories = require("./../../model/factoryModel/model.extraPaymentCategories")
const ExtraPayments = require("./../../model/factoryModel/model.extraPayments")


router.post("/create", auth, catchAsync(async (req, res, next) => {

    const existData = await Tailor.find({ username: req.body.tailer.username.toLowerCase() });

    if (existData.length > 0) {

        res.status(200).json({
            status: true,
            message: "Tailer already exist with this name !.",
            data: null
        });

    }

    try{

        const tailerCreate = await Tailor.create({
            firstname: req.body.tailer.firstname,
            lastname: req.body.tailer.lastname,
            thai_fullname: req.body.tailer.thai_fullname,
            image: req.body.tailer.image,
            process_id: req.body.tailer.process_id,
            username: req.body.tailer.username,
            password: req.body.tailer.password,
            phone: req.body.tailer.phone
        });

        res.status(200).json({
            status: true,
            message: "Tailer created successfully!",
            data: tailerCreate
        });
        
    }catch(err){

        res.status(200).json({
            status: true,
            message: err.message,
            data: null
        });
    }    

}));

router.post("/fetchAll", auth, catchAsync(async (req, res, next) => {

    try{

        const tailers = await Tailor.find().populate("process_id");
        // const tailers = await Tailor.find();
        
        if(tailers.length > 0){
          return res.json({
            status: true,
            message: "Tailers fetched successfully !.",
            data: tailers
          })
        }else{
          return res.json({
            status: false,
            message: "No Tailers found !.",
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

router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {
    try{

        const tailer = await Tailor.find({_id : req.params.id});
        
        if(tailer.length > 0){
          return res.json({
            status: true,
            message: "Tailer fetched successfully !.",
            data: tailer
          })
        }else{
          return res.json({
            status: false,
            message: "No Tailer found with this ID!.",
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
}));

router.put("/update/:id", auth, catchAsync(async (req, res, next) => {

    try{

        const tailer = await Tailor.find({_id : req.params.id});
        
        if(tailer.length < 1){
          return res.json({
            status: false,
            message: "No Tailer found with this ID!.",
            data: null
          })
        }
        if(req.body.tailer.username){
          const alreadyExists = await Tailor.find({username: req.body.tailer.username.toLowerCase()})
    
          if(alreadyExists.length > 0 && tailer[0].username != req.body.tailer.username){
      
            return res.json({
              status: false,
              message: "This Tailer username already exists!",
              data: null
            })
      
          }
      
          req.body.tailer.username = req.body.tailer.username.toLowerCase()
        }
       
    
        const updatedTailer = await Tailor.findOneAndUpdate({_id: req.params.id}, req.body.tailer)
    
        return res.json({
          status: true,
          message: "Tailer updated successfully !.",
          data: updatedTailer
        })
    
      }catch(err){
        console.log(err)
        return res.json({
          status: false,
          message: err.message,
          data: null
        })
      }

}));

router.post("/delete/:id", auth, catchAsync(async (req, res, next) => {

    try{

        const tailer = await Tailor.find({_id: req.params.id})
        if(tailer.length > 0 ){
          
        await Tailor.deleteOne({_id: req.params.id});
        
        return res.json({
          status: true,
          message: "Tailer deleted successfully!",
          data: null
        })
      }else{
        return res.json({
          status: false,
          message: "No Tailer found with this ID!",
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
}));

// Assign Item to a Tailor===================================================

// ====================== Pick an Item ==========================

router.post("/assignItem", auth, async(req, res) => {
  try{

    if(req.body.type == "normal"){
      const orderid = req.body.order
    
      const item = req.body.item
      
      const order = await Order.find({orderId: orderid})
  
      const tailor = await req.body.tailor
  
      if(!order.length > 0){
        return res.json({
          status: false,
          message: "Order Id not valid",
          data: null
        })
      }
      if(!Object.keys(order[0]['manufacturing']).includes(item)){
        return res.json({
          status: false,
          message: "no such item in this order",
          data: null
        })
      }
  
      const processes = order[0]['manufacturing'][item]
  
      let process = {}
      let counter = 0;
      let message = "";
      let status = false;
      let  processName = "";
      for(let x of Object.keys(processes)){
        if(processes[x]['status'] == 0){
          if(counter === 0){
            process[x] = processes[x];
            processName = x;
            message = Object.keys(processes)[counter ] + " ready to be assigned..!";
            status = true;
            break;
          }else{
             if(processes[Object.keys(processes)[counter - 1]].status === 2){
              message = Object.keys(processes)[counter ] + " ready to be assigned..!";
              process[x] = processes[x];
              processName = x;
              status = true;
              break;
             }else{
              message = Object.keys(processes)[counter - 1] + " is Not yet complete..!";
              break;
             }
          }
        }
        counter++;
      }
  
      if(status === false){
        return res.json({
          status: status,
          message: message,
          data: null
        })
      }
      let processFound = false
      let currentProcess = {}

      for(let x of tailor['process_id']){
        if(x.name === processName){
          processFound = true
          currentProcess = x
        }
      }
      // const index = Object.keys(processes).indexOf(tailor['process_id'][i]['name'])
  
      if(processFound === false){
        return res.json({
          status: false,
          message: "You are not authorized for this process..!",
          data: null
        })
      }
  
      const manufacturingObject = {...order[0]['manufacturing']}
  
      manufacturingObject[item][processName]['status'] = 1
  
      manufacturingObject[item][processName]['tailor_id'] = tailor['_id']
  
      await Order.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})
  
      // ======================create a job card for this process for this tailor=============================
  
      const job = {
        tailor: tailor['_id'],           
        process: currentProcess['_id'],
        order_id: order[0]['_id'],
        item_code: orderid + "/" + item,
        cost: currentProcess['price']
      }
  
      // if(currentProcess['name'].includes('stitching')){
      //   job['cost'] = Number(job['cost']) + Number(order[0]['workerprice'][item])
      // }
  
      // if(currentProcess['name'].includes('stitching')){
      //   job['cost'] = Number(job['cost'])
      //   job['stylingprice'] = order[0]['stylingprice']?.[item] || {}
      // }
      if(order[0]['stylingprice'] && order[0]['stylingprice'][item]){
        for(let x of Object.keys(order[0]['stylingprice'][item])){
          if(order[0]['stylingprice'][item][x]['process'] === currentProcess['_id']){
            job['cost'] = Number(job['cost'])
            // job['cost'] = Number(job['cost']) + Number(order[0]['stylingprice'][item][x]['workerprice'])
            let newObj = {}
            newObj[x] = order[0]['stylingprice'][item][x]['workerprice']
            job['stylingprice'] = {...job['stylingprice'], ...newObj}
          }
        }
      }else{
        job['cost'] = Number(job['cost'])
        job['stylingprice'] = {}
      }
    


      const newJob = new Jobs(job)
  
      await newJob.save()
      
      const getJob = await Jobs.find({_id: newJob['id']}).populate('order_id').populate('group_order_id').populate('process').populate('tailor').populate('extraPayments')
  
          // =====================================================================================================
      return res.json({
        status : true,
        message: "The item is assigned to the tailor for the process",
        data:getJob
      })
    }else{
      const orderid = req.body.order
    
      const item = req.body.item
  
      const customer = req.body.customer
      
      const group = await GroupOrder.find({orderId: orderid})
  
      const tailor = await req.body.tailor
  
      
  
      if(!group.length > 0){
        return res.json({
          status: false,
          message: "Order Id not valid",
          data: null
        })
      }
      if(!Object.keys(group[0]['manufacturing'][customer]).includes(item)){
        return res.json({
          status: false,
          message: "no such item in this order",
          data: null
        })
      }

      const processes = group[0]['manufacturing'][customer][item]
      
      let process = {}
      let counter = 0;
      let message = "";
      let status = false;
      let  processName = "";
      for(let x of Object.keys(processes)){
        if(processes[x]['status'] == 0){
          if(counter === 0){
            process[x] = processes[x];
            processName = x;
            message = Object.keys(processes)[counter ] + " ready to be assigned..!";
            status = true;
            break;
          }else{
             if(processes[Object.keys(processes)[counter - 1]].status === 2){
              message = Object.keys(processes)[counter ] + " ready to be assigned..!";
              process[x] = processes[x];
              processName = x;
              status = true;
              break;
             }else{
              message = Object.keys(processes)[counter - 1] + " is Not yet complete..!";
              break;
             }
          }
        }
        counter++;
      }  
      
      if(status === false){
        return res.json({
          status: status,
          message: message,
          data: null
        })
      }
      let processFound = false
      let currentProcess = {}

      for(let x of tailor['process_id']){
        if(x.name === processName){
          processFound = true
          currentProcess = x
        }
      }
  
      if(processFound === false){
        return res.json({
          status: false,
          message: "You are not authorized for this process..!",
          data: null
        })
      }
  
      
      const manufacturingObject = {...group[0]['manufacturing']}
      manufacturingObject[customer][item][processName]['status'] = 1
      manufacturingObject[customer][item][processName]['tailor_id'] = tailor['_id']
      await GroupOrder.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})
  
      const job = {
        tailor: tailor['_id'],
        process: currentProcess['_id'],
        group_order_id: group[0]['_id'],
        item_code: orderid+ "/" + item,
        cost: currentProcess['price'],
        customer: customer  
  
      }
  
      if(currentProcess['name'].includes('stitching')){
        job['cost'] = Number(job['cost']) + Number(group[0]['workerprice'][item])
      }
      console.log("item: ", item)
      console.log("worker price: ", group[0]['workerprice'])
      console.log("job: ", job)
      const newJob = new Jobs(job)
      await newJob.save()

      const getJob = await Jobs.find({_id: newJob['id']}).populate('order_id').populate('group_order_id').populate('process').populate('tailor').populate('extraPayments')
  
      // =====================================================================================================
      return res.json({
        status : true,
        message: "The item is assigned to the tailor for the process",
        data:getJob
      })
    }

  }catch(err){
    console.log("err: ", err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});

router.post("/createExtraPayment", auth, async(req, res) => {
  try{

    const extraPayments = req.body.extraPayments
    const tailor = req.body.tailor 
    const item_code = req.body.item
    let extraPaymentsArray = []

    for(let x of extraPayments){
      
      const extraPaymentCategories = await ExtraPaymentCategories.find({_id: x})

      let data = {}

      if(item_code.split("/").length == 2){
        data = {
          product: extraPaymentCategories[0]['product'],
          tailor: tailor, 
          item_code: item_code, 
          extraPaymentCategory: extraPaymentCategories[0]['_id'], 
          cost: extraPaymentCategories[0]['cost']
        }
        if(req.body.type == "group"){
          data['group_order_id'] = req.body.order
        }else{
          data['order_id'] = req.body.order
        }
      }else{
        data = {
          product: extraPaymentCategories[0]['product'],
          tailor: tailor, 
          item_code: item_code, 
          extraPaymentCategory: extraPaymentCategories[0]['_id'], 
          cost: extraPaymentCategories[0]['cost']
        }
        if(req.body.type == "group"){
          data['group_order_id'] = req.body.order
        }else{
          data['order_id'] = req.body.order
        }
    }

      const newExtraPayment = new ExtraPayments(data)
      await newExtraPayment.save()
      extraPaymentsArray.push(newExtraPayment['_id'])
      
    }

    const job = await Jobs.findOne({_id: req.body.job})
    job['extraPayments'] = extraPaymentsArray
    await job.save()
    return res.json({
      status : true,
      message: "Extra Payments Created for this Process",
      data   : null
    })
  }catch(err){
    return res.json({
      status : false,
      message: err.message,
      data   : null
    })
  }
})

module.exports = router