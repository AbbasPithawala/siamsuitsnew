const express = require('express')
const router = express.Router()
const Tailor = require("./../../model/factoryModel/model.tailor")
const ExtraPayments = require("./../../model/factoryModel/model.extraPayments")
const Order = require("./../../../retailer/model/model.Order")
const GroupOrder = require("./../../../retailer/model/model.groupOrder")

const Process = require("./../../model/model.ProductProcess")
const Jobs = require("./../../model/factoryModel/model.jobs")
const jwt = require('jsonwebtoken')
const auth = require("./../../../middleware/auth")


router.post('/fetchAll', auth, async(req, res) => {
  try{
    let jobs = []
      
    if(req.body.par){
      jobs = await Jobs.find(req.body.par).populate('order_id').populate('group_order_id').populate('process').populate('tailor').populate('extraPayments')
    }
    else{
      jobs = await Jobs.find().populate('order_id').populate('process').populate('tailor')
    }
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
})

router.put("/update/:id", auth, async(req, res) => {
  try{
    const job = await Jobs.find({_id : req.params.id});
    
    if(job.length < 1){
      return res.json({
        status: false,
        message: "No Category found with this ID!.",
        data: null
      })
    }

    const updatedJob = await Jobs.findOneAndUpdate({_id: req.params.id}, req.body.job)

    return res.json({
      status: true,
      message: "Job updated successfully !.",
      data: updatedJob
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})


router.post("/processFinish", auth, async(req, res) => {
  try{
    if(req.body.type == "normal"){
      const orderid = req.body.order   
      const item = req.body.item
      const order = await Order.find({orderId: orderid})
  
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
      console.log("job: ", job)
      await Jobs.updateOne({_id: job[0]['_id']}, {status : true })
  
      return res.json({
        status : true,
        message: "The Process is marked as complete!.",
        data:{}
      })
    }
    

  }catch(err){
    console.log(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});
// change tailor in the payment summary / job

router.put("/updateWorker/:id", auth, async(req, res) => {
  try{

    const job = await Jobs.find({_id : req.params.id}).populate('process');
    
    if(job.length < 1){
      return res.json({
        status: false,
        message: "No Category found with this ID!.",
        data: null
      })
    }

    const tailor = await Tailor.find({_id: req.body.par.tailor})

    if(!tailor[0]['process_id'].includes(job[0].process._id)){
      return res.json({
        status: false,
        message: "This worker is not authorized to do this job!",
        data: null
      })
    }
    const updatedJob = await Jobs.findOneAndUpdate({_id: req.params.id}, req.body.par)

    if(job[0]['extraPayments']){
      for(let x of job[0]['extraPayments']){
        await ExtraPayments.findOneAndUpdate({_id: x}, {tailor: req.body.par.tailor})
      }
    }


    return res.json({
      status: true,
      message: "Job updated successfully !.",
      data: {job: job, tailor: tailor}
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


router.post('/fetchUnfinishedJobs', auth, async(req, res) => {
  try{
    let jobs = []
    console.log(req.body.par)
    if(req.body.par){
      jobs = await Jobs.find(req.body.par).populate('order_id').populate('group_order_id').populate('process').populate('tailor').populate('extraPayments')
    }
    else{
      jobs = await Jobs.find().populate('order_id').populate('process').populate('tailor')
    }
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
})

// router.delete('/:id', auth, async(req, res) => {
//   try{
//     const job = await Jobs.find({_id : req.params.id});
    
//     if(job.length < 1){
//       return res.json({
//         status: false,
//         message: "No job found with this ID!.",
//         data: null
//       })
//     }

//     await Jobs.findOneAndDelete({_id: req.params.id})

//     return res.json({
//       status: true,
//       message: "Job deleted successfully !.",
//       data: null
//     })

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })


module.exports= router