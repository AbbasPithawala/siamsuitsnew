const express = require('express')
const router = express.Router()
const Tailor = require("./../admin/model/factoryModel/model.tailor")
const Product = require("./../admin/model/model.products")
const Process = require("./../admin/model/model.ProductProcess")
const ExtraPaymentCategories = require("./../admin/model/factoryModel/model.extraPaymentCategories")
const ExtraPayments = require("./../admin/model/factoryModel/model.extraPayments")
const WorkerAdvancePayment = require("./../admin/model/factoryModel/model.workerAdvancePayments")
const Payments = require('./../admin/model/factoryModel/model.payments')
const Order = require("./../retailer/model/model.Order")
const GroupOrder = require("./../retailer/model/model.groupOrder")
const Jobs = require("./../admin/model/factoryModel/model.jobs")
const jwt = require('jsonwebtoken')
const auth = require("./auth")


// tailor login ==========================

router.post("/login", async (req, res) => {
  try {

    const tailor = await Tailor.find({username: req.body.username, password: req.body.password}).populate('process_id')
    if (!tailor[0]) {
      return res.json({
        status: false,
        message: "The given data was invalid",
        data: {}
      })
    }
    
    if(!tailor[0]['isActive']){
      return res.json({
        status: false,
        message: "You have no longer access to this app!",
        data: {}
      })
    }

    const newTailor = {...tailor[0]['_doc']}

    delete newTailor['password']
    
    const token = jwt.sign({ id: newTailor._id.toString() }, process.env.JWT_SECRET)

    const data = {}
    data['tailor'] = newTailor
    data['token'] = token

    return res.json({
      status: true,
      message: "Login successfull!",
      data: data
    })

  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: {}
    })

  }

});


// fetch All Orders=======================

router.get("/fetchOrders", auth, async(req, res) => {
  const orders = await Order.find({order_status: "New Order"})
    if(!orders.length > 0){
      return res.send({
        status: false,
        message: "No New Orders for now!",
        data: {}
      })
    }
  return res.send({
    status: true,
    message: "Orders Fetched Successfully!",
    data: orders
  })

});


// ====================== Pick an Item ==========================

router.post("/assignItem", auth, async(req, res) => {

  try{

    if(req.body.type == "normal"){
      const orderid = req.body.order
    
      const item = req.body.item
      
      const order = await Order.find({orderId: orderid})
  
      const tailor = await req.tailor
  
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

      if(currentProcess['name'].includes('stitching')){
        // job['cost'] = Number(job['cost']) + Number(order[0]['workerprice'][item])      
        const newObj = {...order[0]['stylingprice'][item]}
        for(let x of Object.keys(newObj)){
          if(x.includes('button')){
            delete newObj[x]
          }
        }
        job['cost'] = Number(job['cost'])
        job['stylingprice'] = newObj
      }
      if(currentProcess['name'].includes('button')){
        // job['cost'] = Number(job['cost']) + Number(order[0]['workerprice'][item])      
        const newObj = {...order[0]['stylingprice'][item]}
        for(let x of Object.keys(newObj)){
          if(!x.includes('button')){
            delete newObj[x]
          }
        }
        job['cost'] = Number(job['cost'])
        job['stylingprice'] = newObj
      }

  
      const newJob = new Jobs(job)
  
      await newJob.save()  
          // =====================================================================================================
      return res.json({
        status : true,
        message: "The item is assigned to the tailor for the process",
        data: newJob
      })
    }else{
      const orderid = req.body.order
    
      const item = req.body.item
  
      const customer = req.body.customer
      
      const group = await GroupOrder.find({orderId: orderid})
  
      const tailor = await req.tailor
  
      
  
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
      // const index = Object.keys(processes).indexOf(tailor['process_id'][i]['name'])
  
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
       
        // job['cost'] = Number(job['cost']) + Number(group[0]['workerprice'][item])
        job['cost'] = Number(job['cost'])
        job['stylingPrice'] = group[0]['stylingprice'][item]
      }
      const newJob = new Jobs(job)
      await newJob.save()
      // =====================================================================================================
      return res.json({
        status : true,
        message: "The item is assigned to the tailor for the process",
        data:newJob
      })
    }


    // for(let i = 0; i< tailor['process_id'].length; i++){ 

    //   const index = Object.keys(processes).indexOf(tailor['process_id'][i]['name'])

    //   if(index !== -1){ 

    //     if(index == 0){

    //       if(order[0]['manufacturing'][item][tailor['process_id'][i]['name']]['status'] == 1){
    //         return res.json({
    //           status : false,
    //           message: "This item is already assigned to a tailor!.",
    //           data   : {}
    //         })
    //       }

    //       if(order[0]['manufacturing'][item][tailor['process_id'][i]['name']]['status'] == 2){            
    //         return res.json({
    //           status : false,
    //           message: "This process is already complete for this item!.",
    //           data   : {}
    //         })
    //       }

    //       const manufacturingObject = {...order[0]['manufacturing']}

    //       manufacturingObject[item][tailor['process_id'][i]['name']]['status'] = 1

    //       manufacturingObject[item][tailor['process_id'][i]['name']]['tailor_id'] = tailor['_id']

    //       await Order.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})

    //       // ======================create a job card for this process for this tailor=============================

    //       const job = {
    //         tailor: tailor['_id'],
    //           process: tailor['process_id'][i]['_id'],
    //             order_id: order[0]['_id'],
    //             item_code: orderid+ "/" + item,
    //           cost: tailor['process_id'][i]['price'],
    //         status: false
    //       }

    //       if(tailor['process_id'][i]['name'].includes('stitching')){
    //         job['cost'] = Number(job['cost']) + Number(order[0]['workerprice'][item])
    //       }

    //       const newJob = new Jobs(job)
    //       await newJob.save()

    //       // =====================================================================================================

    //       return res.json({
    //         status : true,
    //         message: "The item is assigned to the tailor for the process",
    //         data:{}
    //       })
          
        
    //     }else{

    //       const previousProcess = processes[Object.keys(processes)[index - 1]]
          
    //       const thisProcess = processes[Object.keys(processes)[index]]

    //     if(previousProcess['status'] == 2 ){
    //        if(thisProcess['status'] == 0)
    //        { 
    //         const manufacturingObject = {...order[0]['manufacturing']}            

    //         manufacturingObject[item][tailor['process_id'][i]['name']]['status'] = 1
            
    //         manufacturingObject[item][tailor['process_id'][i]['name']]['tailor_id'] = tailor['_id']
            
    //         await Order.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})

    //          // ======================create a job card for this process for this tailor=============================

    //       const job = {
    //         tailor: tailor['_id'],           
    //         process: tailor['process_id'][i]['_id'],
    //         order_id: order[0]['_id'],
    //         item_code: orderid+ "/" + item,
    //         cost: tailor['process_id'][i]['price'],
    //         status: false
  
    //       }

    //       if(tailor['process_id'][i]['name'].includes('stitching')){
    //         job['cost'] = Number(job['cost']) + Number(order[0]['workerprice'][item])
    //       }

    //       const newJob = new Jobs(job)

    //       await newJob.save()

    //       // =====================================================================================================
    //         return res.json({
    //           status : true,
    //           message: "The item is assigned to the tailor for the process",
    //           data:{}
    //         })
    //       }else{
    //         return res.json({
    //           status : true,
    //           message: "The item is already assigned to a tailor for this process",
    //           data:{}
    //         })
    //       }
    //       }else{
    //         return res.json({
    //           status : false,
    //           message: `${Object.keys(processes)[index - 1]} is not yet complete!`,
    //           data:{}
    //         })
    //       }
    //     }
        
    //   }else{
    //     if(i+1 == tailor['process_id'].length){
    //       return res.json({
    //         status : false,
    //         message: "You are not authorized to take this item",
    //         data:{}
    //       })
    //     }
    //   }
    // }
  }catch(err){
console.log(err)
    return res.json({
      status: false,
      message: err,
      data: null
    })
  }
});


// ====================== process finish =========================

router.post("/processFinish", auth, async(req, res) => {
  try{
    if(req.body.type == "normal"){
      const orderid = req.body.order   
      const item = req.body.item
      let order = await Order.find({orderId: orderid})
        
      const process = await Process.find({name: req.body.process.name})
  
      if(!process.length > 0){
        return res.json({
          status: false,
          message: "Process not valid",
          data: null
        })
      }
      const itemCode = orderid + "/" + item
      const job = await Jobs.find({item_code: itemCode, process: process[0]['_id']})
  
      if(!job.length > 0){
        return res.json({
          status: false,
          message: "No Job Found",
          data: null
        })
      }
  
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
      if(order[0]['manufacturing'][item][req.body.process.name]['status'] == 0){
        return res.json({
          status: false,
          message: "Process is not ready to be marked as complete!.",
          data: null
        })
      }
      if(order[0]['manufacturing'][item][req.body.process.name]['status'] == 2){
        return res.json({
          status: false,
          message: "Process is already complete!.",
          data: null
        })
      }
  
      const manufacturingObject = {...order[0]['manufacturing']}
              
      manufacturingObject[item][req.body.process.name]['status'] = 2
  
      await Order.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})
  
      await Jobs.updateOne({_id: job[0]['_id']}, {status : true, })
  
      return res.json({
        status : true,
        message: "The Process is marked as complete!.",
        data:{}
      })
    }else{
      const orderid = req.body.order   
      const item = req.body.item
      const customer = req.body.customer
      let order = await GroupOrder.find({orderId: orderid})
      const process = await Process.find({name: req.body.process.name})
  
      if(!process.length > 0){
        return res.json({
          status: false,
          message: "Process not valid",
          data: null
        })
      }
      const itemCode = orderid + "/" + item
      const job = await Jobs.find({item_code: itemCode, process: process[0]['_id']})
  
      if(!job.length > 0){
        return res.json({
          status: false,
          message: "No Job Found",
          data: null
        })
      }
  
      if(!order.length > 0){
        return res.json({
          status: false,
          message: "Order Id not valid",
          data: null
        })
      }
  
      if(!Object.keys(order[0]['manufacturing'][customer]).includes(item)){
        return res.json({
          status: false,
          message: "no such item in this order",
          data: null
        })
      }
      if(order[0]['manufacturing'][customer][item][req.body.process.name]['status'] == 0){
        return res.json({
          status: false,
          message: "Process is not ready to be marked as complete!.",
          data: null
        })
      }
      if(order[0]['manufacturing'][customer][item][req.body.process.name]['status'] == 2){
        return res.json({
          status: false,
          message: "Process is already complete!.",
          data: null
        })
      }

      const manufacturingObject = {...order[0]['manufacturing']}
      manufacturingObject[customer][item][req.body.process.name]['status'] = 2

      await GroupOrder.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})
  
      await Jobs.updateOne({_id: job[0]['_id']}, {status : true, })
  
      return res.json({
        status : true,
        message: "The Process is marked as complete!.",
        data:{}
      })
    }
    

  }catch(err){
    return res.json({
      status: false,
      message: err,
      data: null
    })
  }
});

// ====================== assign group order item ========================

// ====================== Pick an Item ==========================

router.post("/assignItemGroup", auth, async(req, res) => {

  try{
    const orderid = req.body.order
    
    const item = req.body.item

    const customer = req.body.customer
    
    const group = await GroupOrder.find({orderId: orderid})

    const tailor = await req.tailor

    

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
    // const index = Object.keys(processes).indexOf(tailor['process_id'][i]['name'])

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
      cost: currentProcess['price']

    }

    if(currentProcess['name'].includes('stitching')){
      job['cost'] = Number(job['cost']) + Number(group[0]['workerprice'][item])
    }

    const newJob = new Jobs(job)

    await newJob.save()
    // =====================================================================================================
    return res.json({
      status : true,
      message: "The item is assigned to the tailor for the process",
      data:{}
    })

    // for(let i = 0; i< tailor['process_id'].length; i++){ 
    //   const index = Object.keys(processes).indexOf(tailor['process_id'][i]['name'])

    //   if(index !== -1){
    //     if(index == 0){
    //       if(group[0]['manufacturing'][customer][item][tailor['process_id'][i]['name']]['status'] == 1){
    //         return res.json({
    //           status : false,
    //           message: "This item is already assigned to a tailor!.",
    //           data:{}
    //         })
    //       }
    //       if(group[0]['manufacturing'][customer][item][tailor['process_id'][i]['name']]['status'] == 2){
            
    //         return res.json({
    //           status : false,
    //           message: "This process is already complete for this item!.",
    //           data:{}
    //         })
    //       }
    //       const manufacturingObject = {...group[0]['manufacturing']}
    //       manufacturingObject[customer][item][tailor['process_id'][i]['name']]['status'] = 1
    //       manufacturingObject[customer][item][tailor['process_id'][i]['name']]['tailor_id'] = tailor['_id']
    //       await GroupOrder.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})
    //       // console.log(manufacturingObject)
    //       // ======================create a job card for this process for this tailor=============================

    //       const job = {
    //         tailor: tailor['_id'],
    //         process: tailor['process_id'][i]['_id'],
    //         order_id: group[0]['_id'],
    //         item_code: orderid+ "/" + item,
    //         cost: tailor['process_id'][i]['price'],
    //         status: false

    //       }

    //       if(tailor['process_id'][i]['name'].includes('stitching')){
    //         job['cost'] = Number(job['cost']) + Number(group[0]['workerprice'][item])
    //       }
    //       const newJob = new Jobs(job)
    //       await newJob.save()
    //       // =====================================================================================================
    //       return res.json({
    //         status : true,
    //         message: "The item is assigned to the tailor for the process",
    //         data:{}
    //       })
    //     }else{

    //       const previousProcess = processes[Object.keys(processes)[index - 1]]
          
    //       const thisProcess = processes[Object.keys(processes)[index]]

          
    //     if(previousProcess['status'] == 2 ){
    //        if(thisProcess['status'] == 0)
    //        { 
    //         const manufacturingObject = {...group[0]['manufacturing']}            

    //         manufacturingObject[customer][item][tailor['process_id'][i]['name']]['status'] = 1
            
    //         manufacturingObject[customer][item][tailor['process_id'][i]['name']]['tailor_id'] = tailor['_id']
            
    //         await GroupOrder.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})

    //          // ======================create a job card for this process for this tailor=============================

    //       const job = {
    //         tailor: tailor['_id'],           
    //         process: tailor['process_id'][i]['_id'],
    //         order_id: group[0]['_id'],
    //         item_code: orderid+ "/" + item,
    //         cost: tailor['process_id'][i]['price'],
    //         status: false
  
    //       }
    //       if(tailor['process_id'][i]['name'].includes('stitching')){
    //         job['cost'] = Number(job['cost']) + Number(group[0]['workerprice'][item])
    //       }
    //       const newJob = new Jobs(job)
    //       await newJob.save()
    //       // =====================================================================================================
    //         return res.json({
    //           status : true,
    //           message: "The item is assigned to the tailor for the process",
    //           data:{}
    //         })
    //       }else{
    //         return res.json({
    //           status : true,
    //           message: "The item is already assigned to a tailor for this process",
    //           data:{}
    //         })
    //       }
    //       }else{
    //         return res.json({
    //           status : false,
    //           message: `${Object.keys(processes)[index - 1]} is not yet complete!`,
    //           data:{}
    //         })
    //       }

    //     }
        
    //   }else{
    //     if(i+1 == tailor['process_id'].length){
    //       return res.json({
    //         status : false,
    //         message: "You are not authorized to take this item",
    //         data:{}
    //       })

    //     }
    //   }
    // }
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
}); 


// ====================== process finish group =========================

router.post("/processFinishGroup", auth, async(req, res) => {
  try{
    const orderid = req.body.order   
    const item = req.body.item
    const customer = req.body.customer
    const group = await GroupOrder.find({orderId: orderid})

    const process = await Process.find({name: req.body.process.name})

    if(!process.length > 0){
      return res.json({
        status: false,
        message: "Process not valid",
        data: null
      })
    }
    const itemCode = orderid + "/" + item
    const job = await Jobs.find({item_code: itemCode, process: process[0]['_id']})
    console.log(job)

    if(!job.length > 0){
      return res.json({
        status: false,
        message: "No Job Found",
        data: null
      })
    }

    if(!order.length > 0){
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
    if(group[0]['manufacturing'][customer][item][req.body.process.name]['status'] == 0){
      return res.json({
        status: false,
        message: "Process is not ready to be marked as complete!.",
        data: null
      })
    }
    if(group[0]['manufacturing'][customer][item][req.body.process.name]['status'] == 2){
      return res.json({
        status: false,
        message: "Process is already complete!.",
        data: null
      })
    }

    const manufacturingObject = {...group[0]['manufacturing']}
            
    manufacturingObject[customer][item][req.body.process.name]['status'] = 2

    await GroupOrder.updateOne({orderId: orderid}, {manufacturing: manufacturingObject})

    await Jobs.updateOne({_id: job[0]['_id']}, {status : true, })

    return res.json({
      status : true,
      message: "The Process is marked as complete!.",
      data:{}
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});


// ======create extra payment==========================

router.post("/createExtraPayment", auth, async (req, res, next) => {

  try{
    // Check if the job exist-------------------------------
    const job = await Jobs.find({_id : req.body.extraPayment.job}) 

    if(!job.length > 0){
      return res.json({
          status: false,
          message: "No Job found by this ID!",
          data: null
      });
    }

    // return res.json({two: job[0]['tailor'], one: req.body.extraPayment.tailor})

    // check if the tailor is the same-----------------------------------------

    if(job[0]['tailor'] != req.body.extraPayment.tailor){
      return res.json({
        status: false,
        message: "You are not an authorized worker!",
        data: null
    });
    }

    // check if items in the job and in the extra payment categories same-------
    if(job[0]['item_code'] !== req.body.extraPayment.item_code){
        return res.json({
            status: false,
            message: "Items Does not match!",
            data: null
        });    
    }

    // check if the process exist-------------------------------------------------- 
    const process = await Process.find({_id : job[0]['process']})

    if(!process.length > 0){
      return res.json({
          status: false,
          message: "No Processes found in this Job!",
          data: null
      });
    }

    // check if the process is product stitching----------------------------------

    if(!process[0]['name'].includes('stitching')){
      return res.json({
        status: false,
        message: "Cannot create extra payments for " + process[0]['name'] + " !.",
        data: null
    });
    }

    // check if the job is complete--------------------------------------------

    if(!job[0]['status'] == true){
      return res.json({
        status: false,
        message: "The " + process[0]['name'] + " is not yet complete!.",
        data: null
    });
    }

    // return res.json({process, job})
      const product = await Product.find({_id: req.body.extraPayment.product})
      if(!product.length > 0){
          return res.json({
              status: false,
              message: "No Product found by this ID!",
              data: null
          });
      }

      const itemCode = req.body.extraPayment.item_code

      if(itemCode.split("/")[1].split("_")[0] == 'suit'){
        if(product[0]['name'] !== itemCode.split("/")[1].split("_")[1]){
          return res.json({ 
            status: false,
            message: "Item doesnot match with the product!.",
            data: null
        });
        }
      }else{
        if(product[0]['name'] !== itemCode.split("/")[1].split("_")[0]){
          return res.json({
            status: false,
            message: "Item doesnot match with the product!.",
            data: null
        });
        }
      }

      const extraPaymentCategories = await ExtraPaymentCategories.find({_id: req.body.extraPayment.extraPaymentCategory})
      
      if(!extraPaymentCategories.length > 0){
          return res.json({
              status: false,
              message: "No Category found by this ID!",
              data: null
          });
      }
      
      if(extraPaymentCategories[0].product.toString() !== req.body.extraPayment.product){
        return res.json({
          status: false,
          message:  "Products and extra categories do not match!",
          data: null
        });
      }
      const alreadyExist = await ExtraPayments.find({order_id: req.body.extraPayment.order_id, item_code: req.body.extraPayment.item_code, extraPaymentCategory: req.body.extraPayment.extraPaymentCategory})

      if(alreadyExist.length > 0 ){
        return res.json({
          status: false,
          message: "Payment for this has already been created.!",
          data: null
        });
      }

      req.body.extraPayment.cost = extraPaymentCategories[0]['cost']

      const extraPayment  = new ExtraPayments(req.body.extraPayment)

      await extraPayment.save()

      const jobExtraPaymentArray = job[0]['extraPayments'] || []
      
      jobExtraPaymentArray.push(extraPayment['_id'])

      await Jobs.updateOne({_id: job[0]['_id']}, {extraPayments : jobExtraPaymentArray })

      return res.json({
          status: true,
          message: "Worker Extra Payment category created successfully!",
          data: extraPayment
      });
      
  }catch(err){

      return res.json({
          status: true,
          message: err.message,
          data: null
      });
  }    

});

// =============create extra payment new ==========================

router.post("/createExtraPayments", auth, async(req, res) => {
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
          order_id: req.body.order, 
          item_code: item_code, 
          extraPaymentCategory: extraPaymentCategories[0]['_id'], 
          cost: extraPaymentCategories[0]['cost']
        }
      }else{
        data = {
          product: extraPaymentCategories[0]['product'],
          tailor: tailor, 
          group_order_id: req.body.order, 
          item_code: item_code, 
          extraPaymentCategory: extraPaymentCategories[0]['_id'], 
          cost: extraPaymentCategories[0]['cost']
        }
    }

      const newExtraPayment = new ExtraPayments(data)
      await newExtraPayment.save()

      extraPaymentsArray.push(newExtraPayment['_id'])
    }

    const job = await Jobs.findOne({_id: req.body.job})
    job['extraPayments'] = extraPaymentsArray
    console.log(job)
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

// ======================fetch Extra Payment categories======================

router.get("/fetchExtraPaymentCategories", auth, async (req, res, next) => {

  try{

      const extraPaymentCategories = await ExtraPaymentCategories.find().populate("product").populate("feature").populate("style");
      // const tailers = await Tailor.find();
      
      if(extraPaymentCategories.length > 0){
        return res.json({
          status: true,
          message: "Extra Payment Categories fetched successfully !.",
          data: extraPaymentCategories
        })
      }else{
        return res.json({
          status: false,
          message: "No Extra Payment Categories found !.",
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

});


// =============ftech Products=================================

router.get("/fetchProducts", auth, async(req, res)=>{
  try{
    const products = await Product.find().populate("features measurements")
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
});


// ========================fetch jobs===============================

router.post('/fetchJobs', auth, async(req, res) => {
  try{
  
    req.body.par.tailor  = req.tailor._id
    const jobs = await Jobs.find(req.body.par).populate('group_order_id').populate('order_id').populate('process').populate('tailor').populate('extraPayments')
      
    
    if(!jobs.length > 0){
      return res.json({
        data: null,
        message: "No Jobs found!",
        status: false
      })
    }

    return res.json({
      data: jobs,
      message: "Jobs fetched successfully!",
      status: true
    })
  }catch(err){
    return res.json({
      data: null,
      message: err.message,
      status: false
    })
  }
});


// ========================fetch single job===============================

router.post('/fetchJob/:id', auth, async(req, res) => {
  try{
  

    const par = {}
    par.tailor  = req.tailor._id
    par._id = req.params.id

    console.log("mfdsk")
    const jobs = await Jobs.find(par).populate('group_order_id').populate('order_id').populate('process').populate('tailor').populate('extraPayments')
      
    
    if(!jobs.length > 0){
      return res.json({
        data: null,
        message: "No Jobs found!",
        status: false
      })
    }

    return res.json({
      data: jobs,
      message: "Jobs fetched successfully!",
      status: true
    })
  }catch(err){
    return res.json({
      data: null,
      message: err.message,
      status: false
    })
  }
});

// ========================fetch jobs===============================

router.post('/fetchExtraPayments', auth, async(req, res) => {
  try{
  
    // req.body.par.tailor  = req.tailor._id
    const par = {
      tailor: req.tailor._id
    }
    const extraPayments = await ExtraPayments.find(par).populate('extraPaymentCategory').populate('tailor').populate('group_order_id').populate('order_id')
      
    
    if(!extraPayments.length > 0){
      return res.json({
        data: null,
        message: "No Extra Payments found!",
        status: false
      })
    }

    return res.json({
      data: extraPayments,
      message: " Extra Payments fetched successfully!",
      status: true
    })
  }catch(err){
    return res.json({
      data: null,
      message: err.message,
      status: false
    })
  }
});


//  fetch extra payment categories------------------------------------

router.get("/fetchExtraPaymentCategories", auth, async (req, res, next) => {

  try{

      const extraPaymentCategories = await ExtraPaymentCategories.find().populate("product").populate("feature").populate("style");
      // const tailers = await Tailor.find();
      
      if(extraPaymentCategories.length > 0){
        return res.json({
          status: true,
          message: "Extra Payment Categories fetched successfully !.",
          data: extraPaymentCategories
        })
      }else{
        return res.json({
          status: false,
          message: "No Extra Payment Categories found !.",
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

});

// fetch worker payment history---------------------------------------

router.get('/fetchPaymentHistory', auth, async(req, res) => {
  try{

    const tailor = req.tailor
    let payments = await Payments.find({tailor: tailor['_id']}).populate('extraPaymentCategory').populate('tailor').populate('job')

    if(!payments.length > 0){
      return res.json({
        data: null,
        message: "No Payments found!",
        status: false
      })
    }

    return res.json({
      data: payments,
      message: "Payments fetched successfully!",
      status: true
    })
  }catch(err){
    return res.json({
      data: null,
      message: err.message,
      status: false
    })
  }
});


// fetch advance payment history======================================

router.get('/fetchAdvancePaymentHistory', auth, async(req, res) => {
  try{

    const tailor = req.tailor
    let advancePayments = await WorkerAdvancePayment.find({worker: tailor['_id']})

    if(!advancePayments.length > 0){
      return res.json({
        data: null,
        message: "No Payments found!",
        status: false
      })
    }

    return res.json({
      data: advancePayments,
      message: "Advance Payments fetched successfully!",
      status: true
    })
  }catch(err){
    return res.json({
      data: null,
      message: err.message,
      status: false
    })
  }
});


// ==================== route change status ======================

router.post("/changeStatus", async(req, res) => {
  try{
    if(req.body.type == "normal"){
      const order = await Order.find({orderId: req.body.order})
      const manufacturing = order[0]['manufacturing']
      manufacturing[req.body.item][req.body.process]['status'] = 0
  
      
      await Order.updateOne({orderId: req.body.order}, {manufacturing: manufacturing})
  
      return res.json({
        message: "done"
      })
    }else{
      const order = await GroupOrder.find({orderId: req.body.order})
      const manufacturing = order[0]['manufacturing']
      manufacturing[req.body.customer][req.body.item][req.body.process]['status'] = 0
  
      
      await GroupOrder.updateOne({orderId: req.body.order}, {manufacturing: manufacturing})
  
      return res.json({
        message: "done"
      })
    }
  }catch(err){
    return res.json({
      message: err.message
    })
  }
})

module.exports = router