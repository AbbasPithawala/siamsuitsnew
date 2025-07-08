const express = require('express')
const router = express.Router()
const Tailor = require("./../../model/factoryModel/model.tailor")
// const Order = require("./../retailer/model/model.Order")
const Payments = require("./../../model/factoryModel/model.payments")
const auth = require("./../../../middleware/auth")

router.post("/create", auth, async (req, res, next) => {

    try{  
        const payments = await Payments.create(req.body.payment);
          return res.json({
            status: true,
            message: "Payment category created successfully!",
            data: payments
        });          
    }catch(err){  
        return res.json({
            status: true,
            message: err.message,
            data: null
        });
      }    
});


router.post('/fetchAll', auth, async(req, res) => {
  try{
    let payments = []
      
    if(req.body.par){
      payments = await Payments.find(req.body.par).populate('extraPaymentCategory').populate('tailor').populate({
        path: 'job',
        populate: {
          path: 'extraPayments',
          populate: 'extraPaymentCategory'     // ⇢ string form is fine when model name matches ref
        }
      })
    }
    else{
      
      payments = await Payments.find().populate('extraPaymentCategory').populate('tailor').populate({
        path: 'job',
        populate: {
          path: 'extraPayments',
          populate: 'extraPaymentCategory'     // ⇢ string form is fine when model name matches ref
        }
      })
    }
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
})

router.put("/update/:id", auth, async(req, res) => {
  try{
    console.log(req.body)

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
    console.log(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})



module.exports= router