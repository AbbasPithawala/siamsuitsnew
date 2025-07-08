const express = require("express");
const router = express.Router();
const PipingModel = require("../model/model.piping");
const auth = require("../../middleware/auth");
const Piping = require("../model/model.piping");

const PipingSerializer = data => ({
  _id: data._id,
  pipingCode: data.pipingCode,
  supplierName : data.supplierName,
  image: data.image,
  date: data.date

});

// ---------------------Add Piping----------------------------

router.post("/create", auth, async (req, res) => {

    try {
        const existData = await PipingModel.find({ pipingCode: req.body.pipingCode })

        if (existData.length > 0) {
            return res.json({
                status: false,
                message: "Piping already exist !",
                data: null
            })
        }

        req.body.piping.pipingCode = req.body.piping.pipingCode.toUpperCase();

        const data = new PipingModel(req.body.piping)

        await data.save()

        return res.json({
            status: true,
            message: "data created successfully!",
            data: data
        })

    } catch (err) {
        return res.json({
            status: false,
            message: err.message,
            data: null
        })

    }

});
// --------------------Fetch all piping---------------------

router.post("/fetchPagination", auth, async (req, res) => {
    try {
      // const { page = 1, limit = 5 } = req.query;
      let page = req.query.page ;
      let limit = req.query.limit;
      let pipingCode = req.query.pipingCode;
        // console.log(req.query)
        let query = {};

        if (pipingCode && pipingCode !== "null") {
          query = { pipingCode: new RegExp(`${pipingCode}+`, "i") }
        
          if (pipingCode && pipingCode !== "null") {
            query = {
              $or: [{ pipingCode: new RegExp(`${pipingCode}+`, "i") }, { pipingCode: new RegExp(`${pipingCode}+`, "i") }]
            }
          }
        }
        else if (pipingCode && pipingCode !== "null") {
          query = { pipingCode: new RegExp(`${pipingCode}+`, "i") }
        }

        const paginated = await PipingModel.paginate(
          query,
          {
            page,
            limit,
            lean: true,
            // sort: { date: "desc" }
          }
        )
      
        const { docs } = paginated;
        const data = await Promise.all(docs.map(PipingSerializer));
      
        delete paginated["docs"];
        const meta = paginated;

        res.json({ meta, data });
    } catch (err) {
     
        return res.json({
            status: false,
            message: err.message,
            data: null
        })
    }
});

router.post("/fetchAll", auth, async (req, res) => {
  try {
      const data = await PipingModel.find()

      if (data.length > 0) {
          return res.json({
              status: true,
              message: "PipingModel fetched successfully!",
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
          status: false,
          message: err.message,
          data: null
      })
  }
});

// ================Fetch piping==================

router.post("/fetchPiping/:id", auth, async(req, res)=>{
  try{
    const data = await PipingModel.find({_id: req.params.id})
    if(!data.length > 0){
      return res.json({
        status: false,
        message: "Data not found",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "fetch data successfully",
      data: data
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
});



// ================delete a specific piping===================


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const data = await PipingModel.find({_id: req.params.id})
    if(data.length > 0 ){
      
    await PipingModel.deleteOne({_id: req.params.id});
    
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


// ---------------------Edit Piping-----------------------

router.put("/update/:id", auth, async(req, res)=>{

  try{

    const pipingToBeUpdated = await PipingModel.find({_id: req.params.id})

    if(!pipingToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such piping found",
        data: null
      })
    }

    const alreadyExists = await PipingModel.find({pipingCode: req.body.piping.pipingCode})

    if(alreadyExists.length > 0 && pipingToBeUpdated[0].pipingCode != req.body.piping.pipingCode){

      return res.json({
        status: false,
        message: "This pipping already exists!",
        data: null
      })

    }

    req.body.piping.pipingCode = req.body.piping.pipingCode.toUpperCase()
    const updatedPiping = await PipingModel.findOneAndUpdate({_id: req.params.id}, req.body.piping)

    return res.json({
      status: true,
      message: "Piping updated successfully",
      data: updatedPiping
    })

  }catch(err){

    return res.json({
      status: false,
      message: err,
      data: null
    })
    
  }
});





module.exports = router