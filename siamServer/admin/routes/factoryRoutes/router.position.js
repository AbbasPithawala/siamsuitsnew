const express = require("express");
const router = express.Router();
const Position = require("../../model/factoryModel/model.position");
const Product = require("../../model/model.products");
const featureModel = require("../../model/model.features");
const auth = require("../../../middleware/auth");
const APIFeatures = require("../../../utills/apiFeatures");
const catchAsync = require('../../../utills/catchAsync');
const AppError = require('../../../utills/appError');
const mongoose = require("mongoose");


// ======== Create A Positions for a product=============================

router.post("/create", auth, catchAsync(async (req, res, next) => {

  req.body.position['name'] = req.body.position['name'].toLowerCase();

  const existData = await Position.find({ name: req.body.position['name']});

  const product = await Product.find({_id : req.body.position['product']})

  if(!product.length > 0){
    return res.json({
      status: false,
      message: "No product found with this ID !.",
      data: null
    })
  }

  if (existData.length > 0) {
    return res.json({
      status: false,
      message: "This position already exist !.",
      data: null
    })
  }
  try{
    
    const position = new Position(req.body.position);

    await position.save()
      res.status(200).json({
        status: true,
        message: "Position created successfully !.",
        data: position
      });

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

}));

// ====================Fetch All Position============================

router.post("/fetchAll", auth, catchAsync(async (req, res, next) => {

  try{

    const positions = await Position.find();
    
    if(positions.length > 0){
      return res.json({
        status: true,
        message: "Positions fetched successfully !.",
        data: positions
      })
    }else{
      return res.json({
        status: false,
        message: "No Positions found !.",
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


// ====================Fetch a specific Position============================

router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {

  try{

    const position = await Position.find({_id : req.params.id});
    
    if(position.length > 0){
      return res.json({
        status: true,
        message: "Position fetched successfully !.",
        data: position
      })
    }else{
      return res.json({
        status: false,
        message: "No Position found with this ID!.",
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

// ==========================update a position=============================

router.put("/update/:id", auth, catchAsync(async (req, res, next) => {

  try{

    const position = await Position.find({_id : req.params.id});
    
    if(position.length < 1){
      return res.json({
        status: false,
        message: "No Position found with this ID!.",
        data: null
      })
    }
    const alreadyExists = await Position.find({name: req.body.position.name.toLowerCase()})

    if(alreadyExists.length > 0 && position[0].name != req.body.position.name){

      return res.json({
        status: false,
        message: "This Position name already exists!",
        data: null
      })

    }

    req.body.position.name = req.body.position.name.toLowerCase()

    const updatedPosition = await Position.findOneAndUpdate({_id: req.params.id}, req.body.position)

    return res.json({
      status: true,
      message: "Position updated successfully !.",
      data: updatedPosition
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

}));

// ================delete a specific position===================


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const position = await Position.find({_id: req.params.id})
    if(position.length > 0 ){
      
    await Position.deleteOne({_id: req.params.id});
    
    return res.json({
      status: true,
      message: "Position deleted successfully!",
      data: null
    })
  }else{
    return res.json({
      status: false,
      message: "No Position found with this ID!",
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

});

module.exports = router;



