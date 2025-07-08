const express = require("express")
const router = express.Router()
const auth = require("../../middleware/auth")
const Roles = require("./../model/model.roles") 
const logger = require("./../../middleware/error.log")


// ---------------------Add Role----------------------------

router.post("/create", auth, async(req, res)=>{
 
  try{
    const anyRole = await Roles.find({role_name: req.body.role.role_name})

    if(anyRole.length > 0 ){
      return res.json({
        status: false,
        message: "Role already exist with this name!",
        data: null
      })
    }
      
    const role = new Roles(req.body.role)
    
    await role.save()
    
    return res.json({
      status: true,
      message: "Role created successfully!",
      data: role
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }

})



// --------------------Fetch all roles---------------------

router.post("/fetchAll", auth, async(req, res)=>{
  try{
    const roles = await Roles.find()
    if(roles.length > 0){
      return res.json({
        status: true,
        message: "Roles fetched successfully!",
        data: roles
      })
    }else{
      logger("No roles found")
      return res.json({
        status: false,
        message: "No roles found",
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


// --------------------Fetch a specific role---------------------

router.post("/fetch", auth, async(req, res)=>{
  try{

    const immutable = "administrator"
    if(req.body.role_name == immutable){
      return res.json({
        status: false,
        message: "cannot edit this role",
        data: null
      })
    }
    const role = await Roles.find({_id: req.body.id})
    if(role.length > 0){
      return res.json({
        status: true,
        message: "Role fetched successfully!",
        data: role
      })
    }else{
      logger("No roles found")
      return res.json({
        status: false,
        message: "No role found with this role name",
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


 

// ---------------------Delete Roles----------------------

router.post("/delete", auth, async(req, res)=>{
  try{
    const immutable = "administrator"
    if(req.body.role_name == immutable){
      return res.json({
        status: false,
        message: "cannot delete this role",
        data: null
      })
    }
    const role = await Roles.find({_id: req.body.id})
    if(role.length > 0 ){
      
    await Roles.deleteOne({ _id: req.body.id });
    const roles = await Roles.find()
    
    return res.json({
      status: true,
      message: "Role deleted successfully!",
      data: roles
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

// ---------------------Edit Role-----------------------

router.put("/updateRole", auth, async(req, res)=>{
  try{

    const immutable = "administrator"
    if(req.body.role.role_name == immutable){
      return res.json({
        status: false,
        message: "cannot modify this role",
        data: null
      })
    }
    const rolestoBeUpdated = await Roles.find({role_name: req.body.role.role_name})
    if(!rolestoBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such role found",
        data: null
      })
    }

    const updatedRole = await Roles.findOneAndUpdate({role_name: req.body.role.role_name}, {modules : req.body.role.modules})

    return res.json({
      status: true,
      message: "Role updated successfully",
      data: updatedRole
    })

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
});


router.post("/fetchFromRoleName", auth, async(req, res)=>{
  try{
     
     const role = await Roles.find({role_name: req.body.name})
     
     if(role.length > 0){
       return res.json({
         status: true,
         message: "Role fetched successfully!",
         data: role
       })
     }else{
       return res.json({
         status: false,
         message: "No role found with this role name",
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