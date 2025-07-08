const express = require("express")
const router = express.Router()
const Product = require("../model/model.products")
const Measurement = require("../model/model.measurement")
const auth = require("../../middleware/auth")
const { resolve } = require("path")
const { find } = require("../model/model.products")


// ============create a Measurement==================

router.post("/create", auth, async (req, res) => {

  try {
    const measurementName = req.body.measurement.name.toLowerCase()
    const alreadyExists = await Measurement.find({ name: measurementName })

    if (alreadyExists.length > 0) {
      return res.json({
        status: false,
        message: "Measurement already exists with this name!",
        data: null
      })
    }

    req.body.measurement.name = measurementName

    const measurement = new Measurement(req.body.measurement)

    await measurement.save()
    if (req.body.measurement.product_id.length > 0) {

      for (let x of req.body.measurement.product_id) {

        const product = await Product.findOne({ _id: x })
        const new_array = product.measurements
        new_array.push(measurement._id)
        await Product.findOneAndUpdate({ _id: x }, { measurements: new_array })

      }

    }


    return res.json({
      status: true,
      message: "measurement created successfully!",
      data: measurement
    })

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ================fetch All measurement===================


router.post("/fetchAll/:skip/:limit", auth, async (req, res) => {

  try {

    const measurements = await Measurement.find().skip(req.params.skip).limit(req.params.limit)

    if (measurements.length < 0) {

      return res.json({
        status: false,
        message: "No Measurements found!",
        data: null
      })

    }

    return res.json({
      status: true,
      message: "Measurements fetched successfully",
      data: measurements
    })

  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

})


// ================fetch a specific measurement===================


router.post("/fetch/:id", auth, async (req, res) => {

  try {
    const measurement = await Measurement.find({ _id: req.params.id })
    if (measurement.length < 0) {
      return res.json({
        status: false,
        message: "No Measurement found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Measurement fetched successfully",
      data: measurement
    })
  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ---------------------Edit measurement-----------------------

router.put("/update/:id", auth, async (req, res) => {

  try {

    const measurementToBeUpdated = await Measurement.find({ _id: req.params.id })

    if (!measurementToBeUpdated.length > 0) {
      return res.json({
        status: false,
        message: "No such measurement found",
        data: null
      })
    }

    const alreadyExists = await Measurement.find({ name: req.body.measurement.name.toLowerCase() })

    if (alreadyExists.length > 0 && measurementToBeUpdated[0].name != req.body.measurement.name) {

      return res.json({
        status: false,
        message: "This Measurement name already exists!",
        data: null
      })

    }

    req.body.measurement.name = req.body.measurement.name.toLowerCase()

    const updatedMeasurement = await Measurement.findOneAndUpdate({ _id: req.params.id }, req.body.measurement)
    console.log(measurementToBeUpdated)

    if (req.body.measurement.product_id.length > 0) {

      for (let x of req.body.measurement.product_id) {

        const product = await Product.findOne({ _id: x })
        const new_array = product.measurements
        if(!new_array.includes(measurementToBeUpdated[0]._id)){
          new_array.push(measurementToBeUpdated[0]._id)
          await Product.findOneAndUpdate({ _id: x }, { measurements: new_array })
        }

      }

    }


    return res.json({
      status: true,
      message: "Measurement updated successfully",
      data: updatedMeasurement
    })

  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }
})


// ================delete a specific measurement===================


router.post("/delete/:id", auth, async (req, res) => {
  try {

    const measurement = await Measurement.find({ _id: req.params.id })

    if (measurement.length > 0) {

      for (let fea of measurement[0].product_id) {

        const product = await Product.find({ _id: fea.toString() })
        const arrayOfMeasurements = product[0].measurements.filter((x) => { return x != req.params.id })
        await Product.findOneAndUpdate({ _id: fea.toString() }, { measurements: arrayOfMeasurements })

      }

      await Measurement.deleteOne({ _id: req.params.id });



      return res.json({
        status: true,
        message: "Measurement deleted successfully!",
        data: null
      })

    } else {

      return res.json({
        status: false,
        message: "No Measurement found with this ID!",
        data: null
      })

    }

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }

})



// ================Fetch Measurement for a Product==================

router.post("/fetchMeasurement/:id", auth, async (req, res) => {

  try {

    const measurements = await Measurement.find({ product_id: req.params.id })
    // return res.json(measurements)

    if (!measurements.length > 0) {
      return res.json({
        status: false,
        message: "No Measurements found for this Product",
        data: null
      })
    }

    return res.json({
      status: true,
      message: "Measurements Fetch for the product successfully",
      data: measurements
    })

  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

})


// =============assign measurement to products===================

router.put("/assign", auth, async (req, res) => {

  try {

    const ifProductExist = await Product.findOne({ _id: req.body.product_id })

    const ifMeasurementExist = await Measurement.findOne({ _id: req.body.measurement_id })

    if (ifProductExist.length < 0) {
      return res.json({
        status: false,
        message: "No Product found with this ID!",
        data: null
      })
    }

    if (ifMeasurementExist.length < 0) {
      return res.json({
        status: false,
        message: "No Measurement found with this ID!",
        data: null
      })
    }

    ifProductExist.measurements.push(req.body.measurement_id)

    ifMeasurementExist.product_id.push(req.body.product_id)

    await ifProductExist.save()

    await ifMeasurementExist.save()

    return res.json({
      status: true,
      message: "Measurement Assigned successfully!",
      data: {
        product: ifProductExist,
        measurement: ifMeasurementExist
      }
    })

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }


})

module.exports = router

