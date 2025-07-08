const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken")
const User = require("../model/model.Admin")
const Retailer = require("../model/model.retailer")
const auth = require("../../middleware/auth")


router.post("/login", async (req, res) => {
  try {

    const user = await User.findOne(req.body)
    const retailer = await Retailer.findOne(req.body)

    if (!user && !retailer) {
      return res.json({
        status: false,
        message: "Wrong Username or Password!",
        data: null
      })
    }


    if (user) {
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET)

      var newUser = {
        username: user.username,
        role: user.role,
        token: token
      }

    }
    else if (retailer) {
      if(retailer['status']){
        const token = jwt.sign({ id: retailer._id.toString()}, process.env.JWT_SECRET)

        var newUser = {
          username: retailer.username,
          retailer_code: retailer.retailer_code,
          retailer_name: retailer.retailer_name,
          id: retailer._id,
          type: "retailer",
          token: token
        }
      }else{
        return res.json({
          status: false,
          message: "You are not a valid retailer",
          data: null
        })
      }

      

    }

    return res.json({
      status: true,
      message: "Login successfull!",
      data: newUser
    })

  } catch (err) {

    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

})


//---------------------create a user----------------------

router.post("/create", auth, async (req, res) => {

  try {
    const alreadyExist = await User.find({ username: req.body.user.username.toLowerCase() })

    if (alreadyExist.length > 0) {
      return res.json({
        status: false,
        message: "User already exist with this username!",
        data: null
      })
    }

    req.body.user.username = req.body.user.username.toLowerCase()
    const user = new User(req.body.user)

    await user.save()

    return res.json({
      status: true,
      message: "user created successfully!",
      data: user
    })

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }

})

// --------------------Fetch all user---------------------

router.post("/fetchAll", auth, async (req, res) => {
  try {
    const users = await User.find()
    if (users.length > 0) {
      return res.json({
        status: true,
        message: "Users fetched successfully!",
        data: users
      })
    } else {
      return res.json({
        status: false,
        message: "No user found",
        data: null
      })
    }
  } catch (err) {
    logger(err)
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ---------------------Delete User----------------------

router.post("/delete", auth, async (req, res) => {
  try {

    const immutable = "administrator"
    if (req.body.role_name == immutable) {
      return res.json({
        status: false,
        message: "cannot delete this user",
        data: null
      })
    }
    const user = await User.find({ _id: req.body.id })
    if (user.length > 0) {

      await User.deleteOne({ _id: req.body.id });
      const users = await User.find()

      return res.json({
        status: true,
        message: "User deleted successfully!",
        data: users
      })
    } else {
      return res.json({
        status: false,
        message: "No role found",
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

// ---------------------Edit User-----------------------

router.put("/update", auth, async (req, res) => {
  try {

    const immutable = "administrator"
    if (req.body.user.role_name == immutable) {
      return res.json({
        status: false,
        message: "cannot update this user",
        data: null
      })
    }
    const usertoBeUpdated = await User.find({ username: req.body.user.username.toLowerCase() })
    if (!usertoBeUpdated.length > 0) {
      return res.json({
        status: false,
        message: "No such user found",
        data: null
      })
    }
    req.body.user.username = req.body.user.username.toLowerCase()
    const updatedUser = await User.findOneAndUpdate({ username: req.body.user.username.toLowerCase() }, req.body.user)

    return res.json({
      status: true,
      message: "User updated successfully",
      data: updatedUser
    })

  } catch (err) {
    return res.json({
      status: false,
      message: err.message,
      data: null
    })

  }
})

// --------------------Fetch a user---------------------

router.post("/fetch", auth, async (req, res) => {
  try {

    const user = await User.find({ _id: req.body.id })

    if (user.length > 0) {

      return res.json({
        status: true,
        message: "User fetched successfully",
        data: user
      })

    } else {

      return res.json({
        status: false,
        message: "No User found with this username",
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
})





module.exports = router