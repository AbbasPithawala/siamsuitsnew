const express = require("express");
const router = express.Router();
const catchAsync = require("../../utills/catchAsync");
const AppError = require("../../utills/appError");
const auth = require("../../middleware/auth");
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const multer = require("multer");
const Customer = require('../model/model.customerMeasurement');
const extractFile = require("../../utills/file");
const fileUpload = multer();
const ShortUniqueId = require("short-unique-id");

cloudinary.config({
  cloud_name: 'di5etqzhu',
  api_key: '297225426521352',
  api_secret: 'AwXV2qb_B9Readq_sGtL0sdn4MA'
});

const CustomerSerializer = data => ({
  _id: data._id,
  firstname: data.firstname,
  lastname: data.lastname,
  fullName: data.fullName,
  gender: data.gender,
  email: data.email,
  retailer_code: data.retailer_code,
  customer_id: data.customer_id,
  measurementsObject: data.measurementsObject,
  suitmeasurementsObject: data.suitmeasurementsObject,
  image: data.image,
  imageNote: data.imageNote,
  date: data.date

});

router.post("/getAllCustomersMesurement", auth, async (req, res, next) => {
  try {

    const data = await Customer.find().sort({ date: -1 });

    if (data.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: data
      })

    } else {

      return res.json({
        status: false,
        message: "No data found",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/getCustomersMesurement/:retailer_code", auth, async (req, res, next) => {
  try {

    const data = await Customer.find({ retailer_code: req.params.retailer_code }).sort({ date: -1 });

    if (data.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: data
      })

    } else {

      return res.json({
        status: false,
        message: "No data found",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/getCustomers/:retailer_code", auth, async (req, res, next) => {
  try {

    const data = await Customer.find({ retailer_code: req.params.retailer_code }, {_id: 1, firstname: 1, lastname: 1}).sort({ date: -1 });

    if (data.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: data
      })

    } else {

      return res.json({
        status: false,
        message: "No data found",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post('/createCustomerMeasurement',async (req, res, next) => {

  try {
    const existCustomer = await Customer.find({firstname: req.body.firstname, lastname: req.body.lastname, retailer_code: req.body.retailer_code });

    if(existCustomer.length > 0 ) {
      return res.json({
        status: false,
        message: "This customer name is already exist, please tyr another name",
        data: []
      })
    }
    const customerMeasurement = await Customer.create({
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      fullname: `${req.body.firstname} ${req.body.lastname}`,
      gender: req.body.gender,
      email: req.body.email,
      phone: req.body.phone,
      retailer_code: req.body.retailer_code,
      image: req.body.image,
      imageNote: req.body.imageNote,
      date: Date.now()
    });
  
    if (!customerMeasurement) {
      return res.json({
        status: false,
        message: "customer not created",
        data: []
      })
    }
  
    return res.json({
      status: true,
      message: "customer created successfully!",
      data: customerMeasurement
    })
    
  } catch (error) {
    return res.json({
      status: true,
      message: error.message,
      data: []
    })
  }

});

router.post('/createCustomer',async (req, res, next) => {

  
  try {
    const existCustomer = await Customer.find({firstname: req.body.firstname, lastname: req.body.lastname, retailer_code: req.body.retailer_code });

    if(existCustomer.length > 0 ) {
      return res.json({
        status: false,
        message: "This customer name is already exist, please tyr another name",
        data: []
      })
    }
    console.log(req.body)
    if(!req.body.measurementsObject){
      req.body.measurementsObject = {}
    }
    if(req.body.suit){      
      req.body.measurementsObject['jacket'] = req.body.suit['jacket']
      req.body.measurementsObject['pant'] = req.body.suit['pant'] 
    }
    if(req.body.tuxedo){      
      req.body.measurementsObject['tuxedojacket'] = req.body.tuxedo['tuxedojacket']
      req.body.measurementsObject['pant'] = req.body.tuxedo['pant'] 
    }
    const customerMeasurement = await Customer.create({
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      fullname: `${req.body.firstname} ${req.body.lastname}`,
      gender: req.body.gender,
      email: req.body.email,
      phone: req.body.phone,
      tag: req.body.tag,
      retailer_code: req.body.retailer_code,
      image: req.body.image,
      imageNote: req.body.imageNote,
      measurementsObject: req.body.measurementsObject,
      suit: req.body.suit,
      tuxedo: req.body.tuxedo,
      date: Date.now()
    });
  
    if (!customerMeasurement) {
      return res.json({
        status: false,
        message: "customer not created",
        data: []
      })
    }
  
    return res.json({
      status: true,
      message: "customer created successfully!",
      data: customerMeasurement
    })
    
  } catch (error) {
    console.log(error)
    return res.json({
      status: true,
      message: error.message,
      data: []
    })
  }

});

router.put("/updateCustomerMesurementStatus/:id", auth, async (req, res) => {

  try {
    const data = await Customer.findByIdAndUpdate(req.params.id, { order_status: req.body.order_status });

    return res.json({
      status: true,
      message: "order status changed successfully",
      data: data
    })
  } catch (err) {
    return res.json({

      status: true,
      message: err.message,
      data: null
    })
  }
});

router.post("/fetchCustomerByID/:id", async (req, res) => {
  try {
    // const [firstname, lastname] = req.body.custName.split(' ')
    const customer = await Customer.find({ _id: req.params.id });
    console.log("customer: ", customer)

    if (customer.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: customer
      })

    } else {

      return res.json({
        status: false,
        message: "No customer found by this ID",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/fetchCustomerByLike/:id", async (req, res) => {
  try {
    const customers = await Customer.find({firstname: { $regex: req.params.id, $options: 'i'}});

    if (customers.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: customers
      })

    } else {

      return res.json({
        status: false,
        message: "No customer found by this ID",
        data: null
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.post("/fetchCustomerssByID", async (req, res) => {
  try {
    let sampleArr = [];
    for (let i = 0; i < req.body.arr.length; i++) {
      let customer = await Customer.findById({ _id: req.body.arr[i] });
      sampleArr.push(customer)
    }

    return res.json({
      status: true,
      message: "fetched successfully",
      data: sampleArr
    })

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});

router.put("/updateCustomerMeasurements/:id", async (req, res) => {
  try {

    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      { measurementsObject: req.body.measurements },
      { new: true }
    );

    return res.json({
      status: true,
      message: "Measurements updated successfully",
      data: data,
      data2: data.measurementsObject
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: []
    })
  }
});

router.put("/updateCustomerMeasurementsSingle/:id", async (req, res) => {
  try {

    const data = await Customer.findById(
      req.params.id
    );
    
    const measurementsObject = {...data.measurementsObject}

    measurementsObject[req.body.product] = req.body.measurements[req.body.product]
    
    if (req.body.product === 'jacket') {
      measurementsObject.tuxedojacket = req.body.measurements.jacket;
    }
    
    // if(req.body.product == 'jacket' && )
    if((req.body.product == 'jacket' || req.body.product == 'pant') && ( measurementsObject['jacket'] && measurementsObject['pant'])){    
      console.log("this is one") 
      let suitObject = {}

      if(data.suit){
        suitObject = data.suit
      }  

      
      if(req.body.product == 'pant'){
        suitObject[req.body.product] = req.body.measurements[req.body.product]
        suitObject['jacket'] = measurementsObject['jacket']
      }
      if(req.body.product == 'jacket'){
        suitObject[req.body.product] = req.body.measurements[req.body.product]
        suitObject['pant'] =measurementsObject['pant']
      }
      const justNewObject = {}
      justNewObject['jacket'] = suitObject['jacket']
      justNewObject['pant'] = suitObject['pant']
      data.suit = justNewObject
      
      data.measurementsObject = measurementsObject

      let tuxedoObject = {}
      if (data.tuxedo) {
        tuxedoObject = data.tuxedo
      }

      if (req.body.product == 'pant') {
        tuxedoObject['pant'] = req.body.measurements['pant']
        tuxedoObject['tuxedojacket'] = measurementsObject['jacket']
      }
      if (req.body.product == 'jacket') {
        tuxedoObject['tuxedojacket'] = req.body.measurements['jacket']
        tuxedoObject['pant'] = measurementsObject['pant']
      }
      
      const justNewTuxedoObject = {}
      justNewTuxedoObject['tuxedojacket'] = tuxedoObject['tuxedojacket']
      justNewTuxedoObject['pant'] = tuxedoObject['pant']
      data.tuxedo = justNewTuxedoObject

      await Customer.findByIdAndUpdate( req.params.id, {measurementsObject: measurementsObject, suit: data.suit, tuxedo: data.tuxedo})
    }else{
      console.log("this one")
      console.log("measurements: ", measurementsObject['jacket'])
      data.measurementsObject = measurementsObject  
      let cust = await Customer.findById(req.params.id)
      console.log("cust: ", cust)
      cust.measurementsObject = measurementsObject
      console.log("cust 2 : ", cust.measurementsObject.jacket)
      await cust.save()
      // await Customer.updateOne({_id: req.params.id}, {measurementsObject : measurementsObject})
      
    }
   
    
    // await data.save()

    return res.json({
      status: true,
      message: "Measurements updated successfully",
      data: data,
      data2: data.measurementsObject
    })
  }
  catch (err) {
    console.log(err.message)
    return res.json({
      status: true,
      message: err.message,
      data: []
    })
  }
});

router.put("/updateCustomerMeasurementsMeanualSize/:id", async (req, res) => {
  try {

    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      { manualSize: req.body.manualSize },
      { new: true }
    );

    return res.json({
      status: true,
      message: "Measurements Manual Size updated successfully",
      data: data,
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: []
    })
  }
});

router.put("/updatesuitCustomerMeasurements/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    // Prepare suit object
    const suitObject = {
      jacket: req.body.measurements.jacket,
      pant: req.body.measurements.pant
    };

    // Prepare tuxedo object
    const tuxedoObject = {
      tuxedojacket: req.body.measurements.jacket,
      pant: req.body.measurements.pant
    };

    // Prepare measurements object
    const measurementsObject = {
      ...customer.measurementsObject,
      jacket: req.body.measurements.jacket,
      tuxedojacket: req.body.measurements.jacket,
      pant: req.body.measurements.pant
    };

    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        measurementsObject: measurementsObject,
        suit: suitObject,
        tuxedo: tuxedoObject
      },
      { new: true }
    );
    
    return res.json({
      status: true,
      message: "Measurements updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: []
    })
  }
});

router.put("/updateTuxedoCustomerMeasurements/:id", async (req, res) => {
  try {

    const customer = await Customer.findById(req.params.id);

    // Prepare tuxedo object
    const tuxedoObject = {
      tuxedojacket: req.body.measurements.tuxedojacket,
      pant: req.body.measurements.pant
    };

    // Prepare suit object
    const suitObject = {
      jacket: req.body.measurements.tuxedojacket, // from tuxedojacket
      pant: req.body.measurements.pant
    };

    // Prepare measurements object
    const measurementsObject = {
      ...customer.measurementsObject,
      tuxedojacket: req.body.measurements.tuxedojacket,
      jacket: req.body.measurements.tuxedojacket, // from tuxedojacket
      pant: req.body.measurements.pant
    };

    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        measurementsObject: measurementsObject,
        suit: suitObject,
        tuxedo: tuxedoObject
      },
      { new: true }
    );
    
    return res.json({
      status: true,
      message: "Measurements updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: []
    })
  }
});

router.post("/getAllCustomersMesurementPaginated", auth, async (req, res, next) => {
  try {

    let page = req.query.page;
    let limit = req.query.limit;
    let retailer_code = req.query.retailer_code;
    let fullname = req.query.fullname;
    let query = {};

    // If you want to get data if match with both fields of firstName and lastName then you can use $and operator with $regex.

    // var query = {$and:[{firstName:{$regex: req.body.customerName, $options: 'i'}},{lastName:{$regex: req.body.customerName, $options: 'i'}}]}
    // and If you want to get data if match with any one field of firstName and lastName then you can use $or operator with $regex.

    // var query = {$or:[{firstName:{$regex: req.body.customerName, $options: 'i'}},{lastName:{$regex: req.body.customerName, $options: 'i'}}]}
    // so can try this code:

    // var query = {}
    // if(req.body.customerName) {
    //   query = {$or:[{firstName:{$regex: req.body.customerName, $options: 'i'}},{lastName:{$regex: req.body.customerName, $options: 'i'}}]}
    // }

    // ModelName.find(query , function (err, data) {
    //    if(error) {
    //      // return error
    //    }
    //    //return data
    // });
    if (retailer_code && retailer_code !== "null") {
      query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    }

    if (fullname && fullname !== "null") {
      query = { fullname: new RegExp(`${fullname}+`, "i") }
    }

    // if (firstname && firstname !== "null") {
    //   query = { firstname: new RegExp(`${firstname}+`, "i") }

    //   if (lastname && lastname !== "null") {
    //     query = {
    //       $or: [{ firstname: new RegExp(`${firstname}+`, "i") }, { lastname: new RegExp(`${lastname}+`, "i") }]
    //     }
    //   } else if (lastname && lastname !== "null") {
    //     query = { lastname: new RegExp(`${lastname}+`, "i") }
    //   }
    // } else if (firstname && firstname !== "null") {
    //   query = { firstname: new RegExp(`${firstname}+`, "i") }
    // }
    const paginated = await Customer.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(CustomerSerializer));

    delete paginated["docs"];
    const meta = paginated;

    res.json({ meta, data });
  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    });
  }
});

router.put("/updateCustomerMeasurementsNewUpdate/:id", async (req, res) => {
  try {
    console.log("customer: ", req.body.customer)

    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body.customer,
      { new: true }
    );

    return res.json({
      status: true,
      message: "Measurements updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

router.put("/updateCustomer/:id", async (req, res) => {
  try {
    // console.log(req.body)
const alreadyExisting = await Customer.find({firstname: req.body.customer.firstname, lastname: req.body.customer.lastname, retailer_code: req.body.customer.retailer_code})
 
if(alreadyExisting.length > 0 && alreadyExisting[0]['_id'] != req.params.id){
      return res.json({
        status: false,
        message: "Customer already present with this name!",
        data: null
      })
    }


    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        firstname: req.body.customer.firstname,
        lastname: req.body.customer.lastname,
        fullName: `${req.body.customer.firstname} ${req.body.customer.lastname}`,
        gender: req.body.customer.gender,
        email: req.body.customer.email,
        phone: req.body.customer.phone,
        retailer_code: req.body.customer.retailer_code,
        image: req.body.customer.image,
        imageNote: req.body.customer.imageNote,
      },
      { new: true }
    );

    return res.json({
      status: true,
      message: "Customer Information updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

router.put("/updateGroupCustomer/:id", async (req, res) => {
  try {
    // console.log(req.body)
    const data = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        fullName: `${req.body.firstname} ${req.body.lastname}`,
        gender: req.body.gender,
        email: req.body.email,
        phone: req.body.phone,
        retailer_code: req.body.retailer_code,
        imageNote: req.body.imageNote,
      },
      { new: true }
    );

    return res.json({
      status: true,
      message: "Customer Information updated successfully",
      data: data
    })
  }
  catch (err) {
    return res.json({
      status: true,
      message: err.message,
      data: null
    })
  }
});

router.post("/getCustomer", async (req, res, next) => {
  try {
    let page = req.query.page;
    let limit = req.query.limit;
    let retailer_code = req.query.retailer_code;
    let firstname = req.query.firstname;
    let customerName = req.query.customerName;
    let lastname = req.query.lastname;
    let query = {};


    // console.log(customerName.split(" ").length)
    //   for(  i = 0, i > customerName.split(" ").length; i++;) {
    //       let txt1 = customerName.split()[i];
    //       console.log(txt1)
    //      return query = {$and:[{firstname:{$regex: txt1, $options: 'i'}},{lastname:{$regex: txt1, $options: 'i'}}]}
    //   }

    //  if (retailer_code && retailer_code !== "null") {
    //     query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    //   }


    //   let txt1 = customerName.split(" ")[0];
    //   let tx2 = customerName.split(" ")[1];

    // console.log(txt1, tx2)
    // // If you want to get data if match with both fields of firstName and lastName then you can use $and operator with $regex.

    //   query = {$and:[{firstname:{$regex: txt1, $options: 'i'}},{lastname:{$regex: tx2, $options: 'i'}}]}


    // and If you want to get data if match with any one field of firstName and lastName then you can use $or operator with $regex.

    // var query = {$or:[{firstName:{$regex: req.body.customerName, $options: 'i'}},{lastName:{$regex: req.body.customerName, $options: 'i'}}]}
    // so can try this code:

    // var query = {}
    // if(req.body.customerName) {
    //   query = {$or:[{firstName:{$regex: req.body.customerName, $options: 'i'}},{lastName:{$regex: req.body.customerName, $options: 'i'}}]}
    // }

    // ModelName.find(query , function (err, data) {
    //    if(error) {
    //      // return error
    //    }
    //    //return data
    // });





    // if (firstname && firstname !== "null") {
    //   query = { firstname: new RegExp(`${firstname}+`, "i")  }

    //   if (lastname && lastname !== "null") {
    //     query = {
    //       $or: [{ firstname: new RegExp(`${firstname}+`, "i") }, { lastname: new RegExp(`${lastname}+`, "i") }]
    //     }
    //   } else if (lastname && lastname !== "null") {
    //     query = { lastname: new RegExp(`${lastname}+`, "i") }
    //   }
    // }  else if (firstname && firstname !== "null") {
    //   query = { firstname: new RegExp(`${firstname}+`, "i") }
    // }



    const paginated = await Customer.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(CustomerSerializer));

    delete paginated["docs"];
    const meta = paginated;

    res.json({ meta, data });
  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    });
  }
});

router.post("/createCustomerGroupOrder", async (req, res) => {

  const customerMeasurement = await Customer.create(req.body);
  if (!customerMeasurement) {
    return res.json({
      status: false,
      message: "customer not created",
      data: null
    })
  }

  return res.json({
    status: true,
    message: "customer created successfully!",
    data: customerMeasurement
  })

})

router.post("/createGroupCustomer", async (req, res, next) => {
  // console.log(req.body.arr_1)
  const customerMeasurement = await Customer.insertMany(req.body.arr_1);

  if (!customerMeasurement) {
    return res.json({
      status: false,
      message: "customer not created",
      data: null
    })
  }

  return res.json({
    status: true,
    message: "customer created successfully!",
    data: customerMeasurement
  })
});

router.post("/searchCustomerData/:id/:name", auth, async(req, res, next) => {
  try {
    // const [firstname, lastname] = req.body.custName.split(' ')
    const customer = await Customer.find({ _id: req.params.id, fullname: req.params.name });

    if (customer.length > 0) {

      return res.json({
        status: true,
        message: "fetched successfully",
        data: customer
      })

    } else {

      return res.json({
        status: false,
        message: "No customer found by this ID",
        data: []
      })

    }

  } catch (err) {

    return res.json({

      status: true,
      message: err.message,
      data: null
    })

  }
});



module.exports = router;
