const express = require("express")
const router = express.Router()
const ManualOrder = require("../model/model.ManualOrder")
const auth = require("../../middleware/auth")

// ---------------------create a manual order----------------------

router.post("/create", auth, async (req, res)=>{
    try{
    
      const order = new ManualOrder(req.body.order)
      
      await order.save()
      
      return res.json({
        status: true,
        message: "Order created successfully!",
        data: order
      })
  
    }catch(err){
      return res.json({
        status: false,
        message: err.message,
        data: null
      })
      
    }
  
})


// ---------------------Fetches all manual orders----------------------

router.get("/fetchAll", auth, async(req, res)=>{
  try {

    const orders = await ManualOrder.find()


    if(orders.length > 0){

      return res.json({
        status: true,
        message: "Orders fetched successfully",
        data: orders
      })

    }else{

      return res.json({
        status: false,
        message: "No orders found",
        data: null
      })

    }
    
  }catch(err){

  return res.json({

        status: true,
        message: err.message,
        data: null
      })

  }

})

// -----------------Fetch A specific order---------------------

router.get("/fetch", auth, async(req, res)=>{
  
  try {

    const orders = await ManualOrder.find({order_id: req.body.order_id})

    if(orders.length > 0){

      return res.json({
        status: true,
        message: "Order fetched successfully",
        data: orders
      })

    }else{

      return res.json({
        status: false,
        message: "No order found with this Id",
        data: null
      })

    }
    
  }catch(err){

  return res.json({

        status: true,
        message: err.message,
        data: null
      })

  }
  
})

// -----------------Fetch  orders according to the status---------------------

router.get("/fetch/status", auth, async(req, res)=>{

  try {

    const orders = await ManualOrder.find({order_status: req.body.status})

    if(orders.length > 0){

      return res.json({
        status: true,
        message: "Orders fetched successfully",
        data: orders
      })

    }else{

      return res.json({
        status: false,
        message: "No orders found with this status",
        data: null
      })

    }
    
  }catch(err){

  return res.json({

        status: true,
        message: err.message,
        data: null
      })

  }
  
})


// --------------changes the status of the order-----------------------

router.post("/")

module.exports = router