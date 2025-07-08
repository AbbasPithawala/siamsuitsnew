const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const DraftMeasurements  = require("../../retailer/model/model.draftedMeasurements");



// router.post("/fetchAll", auth, async (req, res) => {
//   try {

//     const orders = await GroupOrder.find().sort('-date').populate("retailer_id")

//     if (orders.length > 0) {

//       return res.json({
//         status: true,
//         message: "Orders fetched successfully",
//         data: orders
//       })

//     } else {

//       return res.json({
//         status: false,
//         message: "No orders found",
//         data: null
//       })

//     }

//   } catch (err) {

//     return res.json({

//       status: true,
//       message: err.message,
//       data: null
//     })

//   }

// })


// router.put("/updateStatus/:id", auth, async (req, res) => {
//   try {
//     let updateOrder = await GroupOrder.findByIdAndUpdate(req.params.id, { order_status: req.body.order_status }, { new: true })
//     return res.json({
//       status: true,
//       message: "Orders status updated successfully",
//       data: updateOrder
//     })
//   }
//   catch (err) {
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })
//   }
// })

// router.post("/fetchPaginate", auth, async (req, res) => {
//   try {
//     let page = req.query.page ?? 1;
//     let limit = req.query.limit ?? 10;
//     let order_status = req.query.order_status ?? "";
//     let name = req.query.name ?? "";
//     let retailerName = req.query.retailerName ?? "";
//     let retailer_code = req.query.retailer_code ?? "";
//     let orderDate = req.query.orderDate ?? "";
//     let query = {};


//     if (retailerName && retailerName !== "null") {  
//       query = { retailerName: new RegExp(`${retailerName}+`, "i") }
//     }

//     if (retailer_code && retailer_code !== "null") {
//       query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
//     }

//     if (order_status && order_status !== "null") {
//       query = { order_status: new RegExp(`${order_status}+`, "i") }
//     }

//     if (name && name !== "null") {
//       query = { name: new RegExp(`${name}+`, "i") }
//     }

//     if (orderDate && orderDate !== "null") {
//       query = { orderDate: new RegExp(`${orderDate}+`, "i") }
//     }

//     const paginated = await GroupOrder.paginate(
//       query,
//       {
//         page,
//         limit,
//         lean: true,
//         populate: "retailer_id",
//         sort: { date: -1 }
//       }
//     );

//     const { docs } = paginated;
//     const data = await Promise.all(docs.map(GroupOrderSerializer));

//     delete paginated["docs"];
//     const meta = paginated;

//     res.json({ meta, data });
//   } catch (err) {

//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     });
//   }
// });

// router.post("/fetchPaginateGroupCustomerOrders/:customer/:retailer", auth, async (req, res) => {
//   console.log(new ObjectId(req.params.retailer))
//   try {
//     const groupOrders = await GroupOrder.find({retailer_id : req.params.retailer})

//     console.log(groupOrders)
//     if(groupOrders.length > 0){
//       const newGroupOrderArray = groupOrders.filter((singles) => {
//         return singles['customers'].includes(req.params.customer)
//       })

//       if(newGroupOrderArray.length > 0){
//         return res.json({
//           status: true,
//           message: "Group Orders fetched successfully!",
//           data: newGroupOrderArray
//         });
//       }else{
//         return res.json({
//           status: false,
//           message: "This Customer does not belong to any group order!",
//           data: null
//         });
//       }
//     }else{
//       return res.json({
//         status: false,
//         message: "No Group Orders for this retailer",
//         data: null
//       });
//     }
//   } catch (err) {

//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     });
//   }
// });

// router.post("/fetchGroupOrder", auth, async (req, res) => {
//   try {
//     let page = req.query.page ?? 1;
//     let limit = req.query.limit ?? 5;
//     let retailer_code = req.query.retailer_code ?? "";
//     let name = req.query.name ?? "";

//     let query = {};

//     if (retailer_code && retailer_code !== "null") {
//       query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
//     }

//     if (name && name !== "null") {
//       query = { name: new RegExp(`${name}+`, "i") }
//     }

//     const paginated = await GroupOrder.paginate(
//       query,
//       {
//         page,
//         limit,
//         lean: true,
//         sort: { date: -1 }
//       }
//     );

//     const { docs } = paginated;
//     const data = await Promise.all(docs.map(GroupOrderSerializer));

//     delete paginated["docs"];
//     const meta = paginated;

//     res.json({ meta, data });
//   } catch (err) {

//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     });
//   }
// });

router.post("/fetch/:id", auth, async (req, res) => {
  try {
    const measurements = await DraftMeasurements.find({ customer_id: req.params.id})
    if (!measurements.length > 0) {
      return res.json({
        status: false,
        message: "Data not found",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "fetch data successfully",
      data: measurements
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
    const measurements = new DraftMeasurements(req.body.measurements);

    await measurements.save();

    return res.json({
      status: true,
      message: "Create draft measurements successfully",
      data: measurements
    });

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

});


// router.post("/updateProductStyle/:id", auth, async (req, res) => {
//   try {


//     const existData = await GroupOrder.findById(req.params.id);

//     if (!existData) {
//       return res.json({
//         status: false,
//         message: err.message,
//         data: null
//       })
//     }
//     const updateData = await GroupOrder.findByIdAndUpdate(
//       req.params.id,
//        {
//         name: req.body.group.name,
//         product_quantity: req.body.group.product_quantity,
//         order_items: req.body.group.order_items,
//         products: req.body.group.products,
//         customers: req.body.group.customers,
//         customer_quantity: req.body.group.customer_quantity
//        },
//       { new: true }
//     )

//     if (!updateData) {
//       return res.json({
//         status: false,
//         message: err.message,
//         data: null
//       })
//     }

//     return res.json({
//       status: true,
//       message: "Success",
//       data: updateData
//     });

//   } catch (err) {
//     return res.json({
//       status: false,
//       message: err.message,
//       data: null
//     })

//   }

// });




module.exports = router;



