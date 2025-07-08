const express = require("express");
const router = express.Router();
const ShippingBox = require("./../../model/shipping/model.shipping")
const Order = require("./../../../retailer/model/model.Order")
const GroupOrder = require("./../../../retailer/model/model.groupOrder")
const auth = require("../../../middleware/auth");
const catchAsync = require('../../../utills/catchAsync');


// ======== Create A Positions for a product=============================

router.post("/create", auth, catchAsync(async (req, res, next) => {

  try{

    const boxes = await ShippingBox.find({name: req.body.shippingBox.name})
    if(boxes.length > 0){
      return res.json({
        status: false,
        message: "Box already exist with this name !.",
        data: null 
      })
    }

    const box = new ShippingBox(req.body.shippingBox)

    await box.save()

    return res.json({
      status: true,
      message: "Shipping Box created successfully !.",
      data: box
    })


  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

}));

// ====================Fetch Shipping Boxes============================

router.post("/fetch", auth, catchAsync(async (req, res, next) => {
  try{
    let shippingBox;
    if(req.body.retailer == 'no'){
       shippingBox = await ShippingBox.find({isClosed: true}).sort({ date: -1 }).populate('retailer order_id')
    }else{
       shippingBox = await ShippingBox.find({isClosed: true, retailer: req.body.retailer}).sort({ date: -1 }).populate('retailer order_id')
    }

    
    if(shippingBox.length > 0){
      return res.json({
        status: true,
        message: "Shipping Boxes fetched successfully !.",
        data: shippingBox
      })
    }else{
      return res.json({
        status: false,
        message: "No Shipping Boxes found !.",
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

// ===================================add item in the box==================================

router.post("/addItem", auth, async(req, res) => {

 try{
  
  const qrCodeString = req.body.box.itemCode

  if(qrCodeString.split("/").length == 3){

    const customerId = qrCodeString.split("/")[0]
    const order_id = qrCodeString.split("/")[1]
    const item_code = qrCodeString.split("/")[2]

    const group = await GroupOrder.find({orderId : order_id, retailer_id: req.body.box.retailer._id})


    if(!group.length > 0){
      return res.json({
        data: null,
        message: "Not a valid Order!",
        status: false
      })
    }
    let isFound = true;

    if(!Object.keys(group[0]['manufacturing']).includes(customerId)){
      isFound = false
    }

    if(!Object.keys(group[0]['manufacturing'][customerId]).includes(item_code)){
      isFound = false
    }

    if(!isFound){
      return res.json({
        data: null,
        message: "No such item found in the order!",
        status: false
      });
    }

    const alreadyInABox = await ShippingBox.find({items: qrCodeString}) 
    
    if(alreadyInABox.length > 0){
      return res.json({
        data: null,
        message: "Item already in the box",
        status: false
      });
    }
    const shippingBox = await ShippingBox.findById(req.body.box.shippingBox['_id']);

    if(!shippingBox.items.includes(qrCodeString)){
      shippingBox.items.push(qrCodeString);
    }

    if(!shippingBox.order_id.includes(group[0]['_id'])){
      shippingBox.order_id.push(group[0]['_id']);
    }

    await shippingBox.save();
    
    return res.json({
      data: shippingBox,
      message: "Item Put in the box!",
      status: true
    });
  }else{

    const order_id = qrCodeString.split("/")[0]
    const item_code = qrCodeString.split("/")[1]

    const order = await Order.find({orderId : order_id, retailer_id: req.body.box.retailer._id})

    if(!order.length > 0){
      return res.json({
        data: null,
        message: "Not a valid Order!",
        status: false
      })
    }

    let isFound = false;
    for(let x of order[0]['order_items']){
      if(x['item_name'] == item_code.split("_")[0]){
        if(Object.keys(x['styles'][0]).includes(item_code)){        
        isFound = true
        }
      }
    }

    if(!isFound){
      return res.json({
        data: null,
        message: "No such item found in the order!",
        status: false
      });
    }

    const alreadyInABox = await ShippingBox.find({items: qrCodeString}) 
    
    if(alreadyInABox.length > 0){
      return res.json({
        data: null,
        message: "Item already in the box",
        status: false
      });
    }
    const shippingBox = await ShippingBox.findById(req.body.box.shippingBox['_id']);

    if(!shippingBox.items.includes(qrCodeString)){
      shippingBox.items.push(qrCodeString);
    }

    if(!shippingBox.order_id.includes(order[0]['_id'])){
      shippingBox.order_id.push(order[0]['_id']);
    }

    await shippingBox.save();
    
    return res.json({
      data: shippingBox,
      message: "Item Put in the box!",
      status: true
    });

  }
  
 }catch(err){

  return res.json({
    data: null,
    message: err.message,
    status: false
  });

 }


})

// =======================================add complete order in the box=========================

router.post("/addOrder", auth, async(req, res) => {
  try{
    const order_id = req.body.box.orderCode
  
    const order = await Order.find({orderId : order_id, retailer_id: req.body.box.retailer._id})
  
    if(!order.length > 0){
      return res.json({
        data: null,
        message: "Not a valid Order!",
        status: false
      })
    }
  

    const orderItems = Object.keys(order[0]['manufacturing'])
    
    const shippingBox = await ShippingBox.findById(req.body.box.shippingBox['_id']);

    const items = []
    for(let item of orderItems){
      let qrCodeString = order_id + "/" + item
      const alreadyInABox = await ShippingBox.find({items: qrCodeString}) 
  
      if(!alreadyInABox.length > 0 || shippingBox.items.includes(qrCodeString)){
        items.push(qrCodeString)
      }
    }


    if(!items.length > 0){
      return res.json({
        data: null,
        message: "The items in this order are already packed!",
        status: false
      });
    }
  
    const itemsUpdated = shippingBox.items.concat(items)

    shippingBox.items = itemsUpdated
  
    if(!shippingBox.order_id.includes(order[0]['_id'])){
      shippingBox.order_id.push(order[0]['_id']);
    }
  
    await shippingBox.save();
    
    return res.json({
      data: shippingBox,
      message: "Order Items placed in the box!",
      status: true
    });
  
   }catch(err){
  
    return res.json({
      data: null,
      message: err.message,
      status: false
    });
  
   }
  
})

// ==========================fetch shipping boxes for one retailer==========================

router.post("/fetch/:id", auth, async(req, res) => {
  try{

    const shippingBoxes = await ShippingBox.find({retailer: req.params.id, isClosed: req.body.boxType}).populate('retailer')
    if(!shippingBoxes.length > 0){
      return res.json({
        status: false,
        message: "No Open boxes for this retailer!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Shipping Boxes fetched successfully !.",
      data: shippingBoxes
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});

// ===========================fetch single shipping box=========================

router.post("/fetch/:id", auth, async(req, res) => {
  try{
    
    const shippingBox = await ShippingBox.find({_id: req.params.id}).populate('retailer order')
    if(!shippingBox.length > 0){
      return res.json({
        status: false,
        message: "No Open box for this retailer!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Shipping Box fetched successfully !.",
      data: shippingBox
    })
  }catch(err){}
})

//======================update status of the shipping box========================

router.put("/updateStatus/:id", auth, catchAsync(async (req, res, next) => {

  try{

    const shippingBox = await ShippingBox.find({_id : req.params.id});
    
    if(shippingBox.length < 1){
      return res.json({
        status: false,
        message: "No Shipping Box found with this ID!.",
        data: null
      })
    }

    await ShippingBox.findOneAndUpdate({_id: req.params.id}, {status: req.body.status})
    
    const shippingBoxes = await ShippingBox.find({status: true});

    return res.json({
      status: true,
      message: "Shipping Box status updated successfully !.",
      data: shippingBoxes
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

}));

//=======================update the shipping box=================================

router.put("/update/:id", auth, async(req, res) => {

  try{
    const shippingBox = await ShippingBox.find({_id : req.params.id});    

    if(shippingBox.length < 1){
      return res.json({
        status: false,
        message: "No Shipping Box found with this ID!.",
        data: null
      })
    }

    if(req.body.shippingBox.name){

      const alreadyExists = await ShippingBox.find({name: req.body.shippingBox.name.toLowerCase()})
    
      if(alreadyExists.length > 0 && shippingBox[0].name != req.body.shippingBox.name){
        return res.json({
          status: false,
          message: "This Shipping Box name already exists!",
          data: null
        })
      }  
      req.body.shippingBox.name = req.body.shippingBox.name.toLowerCase()
    }

    
    await ShippingBox.findOneAndUpdate({_id: req.params.id}, req.body.shippingBox)
    const updatedShippingBox = await ShippingBox.find({_id: req.params.id})
    return res.json({
      status: true,
      message: "Shipping Box updated successfully !.",
      data: updatedShippingBox
    })

  }catch(err){

    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
});

// ====================Fetch a specific Position============================

// router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {

//   try{

//     const position = await Position.find({_id : req.params.id});
    
//     if(position.length > 0){
//       return res.json({
//         status: true,
//         message: "Position fetched successfully !.",
//         data: position
//       })
//     }else{
//       return res.json({
//         status: false,
//         message: "No Position found with this ID!.",
//         data: null
//       })
//     }

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }

// }));

// ==========================update a position=============================

// router.put("/update/:id", auth, catchAsync(async (req, res, next) => {

//   try{

//     const position = await Position.find({_id : req.params.id});
    
//     if(position.length < 1){
//       return res.json({
//         status: false,
//         message: "No Position found with this ID!.",
//         data: null
//       })
//     }
//     const alreadyExists = await Position.find({name: req.body.position.name.toLowerCase()})

//     if(alreadyExists.length > 0 && position[0].name != req.body.position.name){

//       return res.json({
//         status: false,
//         message: "This Position name already exists!",
//         data: null
//       })

//     }

//     req.body.position.name = req.body.position.name.toLowerCase()

//     const updatedPosition = await Position.findOneAndUpdate({_id: req.params.id}, req.body.position)

//     return res.json({
//       status: true,
//       message: "Position updated successfully !.",
//       data: updatedPosition
//     })

//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }

// }));

// // ================delete a specific position===================


// router.post("/delete/:id", auth, async(req, res)=>{
//   try{

//     const position = await Position.find({_id: req.params.id})
//     if(position.length > 0 ){
      
//     await Position.deleteOne({_id: req.params.id});
    
//     return res.json({
//       status: true,
//       message: "Position deleted successfully!",
//       data: null
//     })
//   }else{
//     return res.json({
//       status: false,
//       message: "No Position found with this ID!",
//       data: null
//     })
//   }
    
//   }catch(err){
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
    
//   }

// })

// router.post("/fetch/:id", auth, catchAsync(async (req, res, next) => {

//   const data = await positionModel.findById(req.params.id)

//   if (!data) {
//     return next(new AppError('No document found', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: data
//   });

// }));




// router.put("/update/:id", auth, catchAsync(async (req, res, next) => {

//   if (!mongoose.isValidObjectId(req.params.id)) {
//     return next(new AppError("invalid Id", 400));
//   }

//   const updateData = await positionModel.findByIdAndUpdate(
//     req.params.id,
//     {
//       name: req.body.name,
//       thai_name: req.body.thai_name,
//       cost: req.body.cost,
//       product: req.body.product,
//       description: req.body.description
//     },
//     { new: true }

//   );

//   if (!updateData) {
//     return next(new AppError('process  failed!', 404));
//   }

//   res.status(200).json({
//     status: true,
//     message: "Position update successfully!",
//     data: updateData
//   });

// }));

// router.post("/delete/:id", auth, catchAsync(async (req, res, next) => {

//   const data = await positionModel.findByIdAndDelete(req.params.id);

//   if (!data) {
//     return next(new AppError('process falied !', 404));
//   }

//   res.status(200).json({
//     status: true,
//     message: "Position deleted successfully!"
//   });

// }));

module.exports = router;



