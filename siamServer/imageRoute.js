const express = require('express');
const router = express.Router();
const extractFile = require("./utills/file");
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier');
const uniqueFilename = require('unique-filename')
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const AWS = require("aws-sdk");


const KEY_ID = process.env.ACCESS_KEY;
const SECRET_ID = process.env.SECRET_KEY;
const BucketName = "siamsuits";

const s3 = new AWS.S3({
  accessKeyId: KEY_ID,
  secretAccessKey: SECRET_ID
})
cloudinary.config({
    cloud_name: 'di5etqzhu',
    api_key: '297225426521352',
    api_secret: 'AwXV2qb_B9Readq_sGtL0sdn4MA'
  });


router.post("/upload", extractFile.single("image"), async(req,res, next) => {
  // console.log("function running")
  // console.log(req.file)
    try { 
      // console.log("fbdskjngl")
      // console.log(req.file)
      // console.log(req.file.filename)
      // const result = await cloudinary.uploader.upload(req.file.path, { folder: 'images' , use_filename :true});
      console.log("image file name: ", req.file.filename)
      console.log("path: ", req.file.path)
      uploadFile(req.file.path, req.file.filename)
      // console.log(result)
      return res.json({
        message: "Upload was successful",
        data: req.file.filename,
        status: true
      });
    } catch (error) {
        next(error.message);
        res.json({
          data: null,
          message: "Image upload Unsuccessfull",
          status: false
        });
      }
});




router.post("/OptionUpload", extractFile.single("image"), async(req,res, next) => {
  try {
      // const result = await cloudinary.uploader.upload(req.file.path, { folder: 'images' , use_filename :true});

      uploadFile(req.file.path, req.file.filename)
      // console.log(result)
      return res.json({
        message: "Upload was successful",
        data: req.file.filename,
        status: true
      });
    } catch (error) {

      next(error.message);
      res.json({
        data: null,
        message: "Image upload Unsuccessfull",
        status: false
      });
    }
});

router.post("/", extractFile.single("image"), async(req,res, next) => {
  // console.log("function running")
  // console.log(req.file)
    try { 
      // console.log("fbdskjngl")
      // console.log(req.file)
      // console.log(req.file.filename)
      // const result = await cloudinary.uploader.upload(req.file.path, { folder: 'images' , use_filename :true});
      // const fileName = req.body.customer['_id'] + req.body.item
      // console.log("image file name: ", fileName)
      uploadFile(req.file.path, req.file.filename)
      // console.log(result)
      return res.json({
        message: "Upload was successful",
        data: req.file.filename,
        status: true
      });
    } catch (error) {
        next(error.message);
        res.json({
          data: null,
          message: "Image upload Unsuccessfull",
          status: false
        });
      }
});

router.post("/uploadManualImage",  async(req,res, next) => {
  console.log(uuidv4())
  try {
    const randomPrefixedTmpfile =  uniqueFilename('./images', 'testing');

    const base64Image = req.body.image.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = new Buffer.from(base64Image, "base64");

     fs.writeFileSync(`${randomPrefixedTmpfile}.png`, imageBuffer);
    
    const fileName = `${randomPrefixedTmpfile}.png`
    console.log("fileName: ", fileName)
    console.log("randomPrefixedTmpfile ", randomPrefixedTmpfile)
    const name = uuidv4() + ".png"
    uploadFileManual(`${randomPrefixedTmpfile}.png`, name)
      return res.json({
        message: "Upload was successful",
        data: name,
        status: true
      });
  }catch (error) {
      res.json({
        data: null,
        message: "Image upload Unsuccessfull",
        status: false
      });
  }
});

// router.post("/uploadManualImage",  async(req,res, next) => {

//   try {
//     // const randomPrefixedTmpfile =  uniqueFilename('./images', 'testing');
//     const randomPrefixedTmpfile =  uniqueFilename('./images', 'snapImg');
//     const snapImgName = randomPrefixedTmpfile.split("\\")[1];
//     const base64Image = req.body.image.replace(/^data:image\/png;base64,/, "");
//     const imageBuffer = new Buffer.from(base64Image, "base64");

//     fs.writeFileSync(`${randomPrefixedTmpfile}.png`, imageBuffer);
    
//     // const fileName = `${snapImgName}.png`
//     // const newFileName = "images/" + fileName.split("\\")[1]
//     uploadFileManual(`${snapImgName}.png`, snapImgName)
//       return res.json({
//         message: "Upload was successful",
//         data: snapImgName,
//         status: true
//       });
//   }catch (error) {
//       res.json({
//         data: null,
//         message: "Image upload Unsuccessfull",
//         status: false
//       });
//   }
// });


  // router.post("/pdfupload", extractFile.single("pdf"), async(req,res, next) => {
  //   try {
  //       const result = await cloudinary.uploader.upload(req.file.path, { folder: 'pdf' , use_filename :true});
  //         return res.json({
  //           message: "Upload was successful",
  //             data: result.public_id,
  //             status: true
  //         });
  //       } catch (error) {
  
  //         next(error.message);
  //         res.json({
  //           data: null,
  //           message: "pdf upload Unsuccessfull",
  //           status: false
  //         });
  //       }
  // });



  const uploadFile = (filePath, filename) => {
    const fileContent = fs.readFileSync(filePath)
    const params = {
      Bucket: BucketName,
      Key: "images/" + filename,
      Body: fileContent,
      // ContentType: "application/pdf"
    }
    s3.upload(params, (err, data) => {
      if(err){
        console.log(err)
      }else{
        fs.unlink(filePath, (err) => {
          if(!err){
            console.log("file removed from local")
          }
        })
        return data.Location
        // console.log("file uploaded: ", data.Location)
      }
    })
  }

  const uploadFileManual = (filePath, filename) => {
    const fileContent = fs.readFileSync(filePath)
    const params = {
      Bucket: BucketName,
      Key: "images/" + filename,
      Body: fileContent,
      // ContentType: "application/pdf"
    }
    s3.upload(params, (err, data) => {
      if(err){
        console.log(err)
      }else{
        fs.unlink(filePath, (err) => {
          if(!err){
            console.log("file removed from local")
          }
        })
        return data.Location
        // console.log("file uploaded: ", data.Location)
      }
    })
  }
module.exports = router; 