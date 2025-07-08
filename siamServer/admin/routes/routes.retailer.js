const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken")
const Retailer = require("./../model/model.retailer")
const User = require("./../model/model.Admin")
const auth = require("./../../middleware/auth")


//---------------------create a user----------------------

router.post("/create", auth, async(req, res)=>{
  try{
    const alreadyExistInRetailer = await Retailer.find({username: req.body.user.username})
    const alreadyExistInAdmin = await User.find({username: req.body.user.username})
    const retailerCodeExist = await Retailer.find({retailer_code: req.body.user.username})

    if(alreadyExistInRetailer.length > 0  || alreadyExistInAdmin.length > 0 || retailerCodeExist > 0 ){
      return res.json({
        status: false,
        message: "retailer already exist with this username!",
        data: null
      })
    }
      
    const retailer = new Retailer(req.body.user)
    
    await retailer.save()
    
    return res.json({
      status: true,
      message: "retailer created successfully!",
      data: retailer
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }

})

// --------------------Fetch all user---------------------

router.post("/fetchAll", auth, async(req, res)=>{
  try{
    const retailers = await Retailer.find()
    if(retailers.length > 0){
      return res.json({
        status: true,
        message: "Retailers fetched successfully!",
        data: retailers
      })
    }else{
      return res.json({
        status: false,
        message: "No retailer found",
        data: null
      })
    }
  }catch(err){
    logger(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ---------------------Delete User----------------------

router.post("/delete", auth, async(req, res)=>{
  try{

    const immutable = "administrator"
    if(req.body.user.role_name == immutable){
      return res.json({
        status: false,
        message: "cannot delete this user",
        data: null
      })
    }
    const user = await User.find({username: req.body.user.username})
    if(role.length > 0 ){
      
    await Retailer.deleteOne({username: req.body.user.username});
    
    return res.json({
      status: true,
      message: "user deleted successfully!",
      data: null
    })
  }else{
    return res.json({
      status: false,
      message: "No role found",
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

})

// ---------------------Edit User-----------------------

router.put("/update", auth, async(req, res)=>{
  try{

    const immutable = "administrator"
    if(req.body.user.role_name == immutable){
      return res.json({
        status: false,
        message: "cannot delete this user",
        data: null
      })
    }
    const usertoBeUpdated = await Retailer.find({username: req.body.user.username})
    if(!usertoBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such user found",
        data: null
      })
    }

    const updatedUser = await Retailer.findOneAndUpdate({username: req.body.user.username}, req.body.user)

    return res.json({
      status: true,
      message: "User updated successfully",
      data: updatedUser
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// --------------------Fetch a user---------------------

router.post("/fetch", auth, async(req, res)=>{
  try {

    const user = await Retailer.find({_id: req.body.id})

    if(user.length > 0){

      return res.json({
        status: true,
        message: "Retailer fetched successfully",
        data: user
      })

    }else{

      return res.json({
        status: false,
        message: "No User found with this username",
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

router.post("/fetch/:id", auth, async(req, res)=>{
  try {

    const user = await Retailer.find({_id: req.params.id})

    if(user.length > 0){

      return res.json({
        status: true,
        message: "Retailer fetched successfully",
        data: user
      })

    }else{

      return res.json({
        status: false,
        message: "No User found with this username",
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

// ===========fetched an existing rertailer code===============

router.post("/fetchRetailerCode", auth, async(req, res)=>{
  // console.log("dsbfdsklfn")
  try {

    const user = await Retailer.find({retailer_code: req.body.retailer_code})

    if(user.length > 0){

      return res.json({
        status: true,
        message: "Retailer fetched successfully",
        data: user
      })

    }else{

      return res.json({
        status: false,
        message: "No User found with this username",
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
})




module.exports = router