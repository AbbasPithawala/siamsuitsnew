const groupFeaturesModel = require("../model/model.groups.feature");
const product = require("../model/model.products");
const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const APIFeatures = require("../../utills/apiFeatures");
const catchAsync = require('../../utills/catchAsync');
const AppError = require('../../utills/appError');
const mongoose = require("mongoose");
const Product = require("../model/model.products");
const featureModel = require("../model/model.features");
const { findByIdAndUpdate } = require("../model/model.features");

router.post("/fetchAll", auth, catchAsync(async (req, res, next) => {

  let filter = {};
  if (req.params.name) filter = { name: req.params.name };

  const features = new APIFeatures(groupFeaturesModel.find(filter).populate("feature_id product_id"), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const data = await features.query;

  if (!data) {
    return next(new AppError('No document found', 404));
  }

  res.status(200).json({
    status: 'success',
    results: data.length,
    data: data
  });

}));

router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {

  const data = await groupFeaturesModel.findById(req.params.id);

  if (!data) {
    return next(new AppError('No document found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: data
  });

}));

router.post("/fetchFeatures/:id", auth, catchAsync(async (req, res, next) => {

  const data = await groupFeaturesModel.find({ product_id: req.params.id }).populate("product_id")

  if (!data) {
    return next(new AppError('No document found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: data
  });

}));


router.post("/create", auth, catchAsync(async (req, res, next) => {

  const existData = await groupFeaturesModel.find({ name: req.body.feature.name.toLowerCase() })

  if (existData.length > 0) {
    return next(new AppError('Feature already exists with this name!', 404));
  }

  req.body.feature.name = req.body.feature.name.toLowerCase()

  const create = await groupFeaturesModel.create({
    name: req.body.feature.name,
    thai_name: req.body.feature.thai_name,
    product_id: req.body.feature.product_id,
    additional: req.body.feature.additional,
    feature_id: req.body.feature.feature_id,
  });

  if (!create) {
    return next(new AppError('process  failed!', 404));
  }

  const product = await Product.find({ _id: req.body.feature.product_id });

  if (product[0].features.length > 0) {
    var features_array = product[0].features
    features_array.push(create._id)
  } else {
    var features_array = []
    features_array.push(create._id)
  }

  const productDataUpdate = await Product.findOneAndUpdate(
    { _id: req.body.feature.product_id },
    { features: features_array },
    { new: true }
  )

  if (!productDataUpdate) {
    return next(new AppError('process  failed!', 404));
  }

  res.status(200).json({
    status: true,
    message: "created successfully!",
    data: create
  });
}));


router.post("/update/:id", auth, catchAsync(async (req, res, next) => {

  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("invalid Id", 400));
  }

  const existData = await groupFeaturesModel.findById(req.params.id);

  if (!existData) {
    return next(new AppError('Data not found!', 404));
  }
  console.log(existData.name)

  const alreadyExists = await groupFeaturesModel.find({ name: req.body.feature.name.toLowerCase() })

  if (alreadyExists.length > 0 && existData.name != req.body.feature.name) {

    return next(new AppError('This Feature name already exists!', 404));

  }

  req.body.feature.name = req.body.feature.name.toLowerCase()
    
  console.log(req.body.feature.feature_id)

  const update = await groupFeaturesModel.findByIdAndUpdate(
    req.params.id,
    req.body.feature,
    { new: true }

  );

  if (!update) {
    return next(new AppError('process  failed!', 404));
  }

  res.status(200).json({
    status: true,
    message: "update successfully!",
    data: update
  });
}));


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const data = await groupFeaturesModel.find({_id: req.params.id})
    if(data.length > 0 ){
      
    await groupFeaturesModel.deleteOne({_id: req.params.id});
    
    return res.json({
      status: true,
      message: " deleted successfully!",
      data: null
    })
  }else{
    return res.json({
      status: false,
      message: "No found with this ID!",
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


