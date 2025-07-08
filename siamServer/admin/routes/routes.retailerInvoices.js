const express = require("express")
const router = express.Router()
const RetailerInvoice = require("../model/model.retailerInvoice")
const Retailer = require("../model/model.retailer")
const auth = require("../../middleware/auth")
const Order = require("../../retailer/model/model.Order")
const fs = require('fs');
const { default: puppeteer } = require('puppeteer');
const path = require('path')
const nodemailer = require("nodemailer");
const multer = require("multer");


const InvoiceSerializer = data => ({
  _id: data._id,
  retailer_code: data.retailer_code,
  invoice_number: data.invoice_number,
  orders: data.orders,
  total_price: data.total_price,
  shipping_charge: data.shipping_charge,
  dueDate: data.dueDate,
  discount: data.discount,
  total_amount: data.total_amount

});

// ============create a style==================

router.post("/create", auth, async(req, res)=>{
  try{


    const retailer = await Retailer.find({retailer_code : req.body.invoice['retailer_code']})

    const fetchExistingInvoice = await RetailerInvoice.find({retailer_code : req.body.invoice['retailer_code']});

    // const orderid = await Order.find({orderId : req.body.invoice['orderid']})

    // if(!orderid.length == 1){

    //   return res.json({
    //     status: false,
    //     message: "Cannot find any order with this order ID!.",
    //     data: null
    //   })      

    // }else 
    if(!retailer.length == 1){

      return res.json({
        status: false,
        message: "Cannot find any retailer with this Retailer code !.",
        data: null
      })

    }
    // let invoiceNumberOfLast = fetchExistingInvoice[fetchExistingInvoice.length - 1]['invoice_number']

    if(fetchExistingInvoice.length > 0){

      const numb = fetchExistingInvoice[fetchExistingInvoice.length - 1]['invoice_number'].split("-")[2]
      const newCode = req.body.invoice['retailer_code'] + "-INV-000" + (Number(numb) + 1)
      
      req.body.invoice.invoice_number = newCode
      // console.log(req.body.invoice)
    }else{
      req.body.invoice.invoice_number = "ABS-INV-000" + 1
    }


    const retailerInvoice = new RetailerInvoice(req.body.invoice)

    await retailerInvoice.save()
  
    return res.json({
      status: true,
      message: "invoice created successfully!",
      data: req.body.invoice
    })

   

  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ================fetch All Styles===================


router.post("/fetchAll/:skip/:limit", auth, async(req, res)=>{
  try{
    const retailerInvoice = await RetailerInvoice.find().skip(req.params.skip).limit(req.params.limit).populate('orders')
    if(!retailerInvoice.length > 0){
      return res.json({
        status: false,
        message: "No Invoice found!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Invoice fetched successfully",
      data: retailerInvoice
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})


// ================fetch a specific invoice===================


router.post("/fetch/:id", auth, async(req, res)=>{
  try{
    const retailerInvoice = await RetailerInvoice.find({_id: req.params.id}).populate('orders')
    if(!retailerInvoice.length > 0){
      return res.json({
        status: false,
        message: "No Invoice found with this ID!",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Invoice fetched successfully",
      data: retailerInvoice
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ================Fetch for a retialer==================

router.post("/fetchRetailerInovice/:id", auth, async(req, res)=>{
  try{
    const retailerInvoice = await RetailerInvoice.find({retailer_code: req.params.id}).populate('orders')
    if(!retailerInvoice.length > 0){
      return res.json({
        status: false,
        message: "No Invoice found for this retailer",
        data: null
      })
    }
    return res.json({
      status: true,
      message: "Invoices Fetch for the Retailer successfully",
      data: retailerInvoice
    })
  }catch(err){
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
  }
})

// ---------------------Edit Retailer -----------------------

router.put("/update/:id", auth, async(req, res)=>{

  try{

    const retailerInvoiceToBeUpdated = await RetailerInvoice.find({_id: req.params.id})

    if(!retailerInvoiceToBeUpdated.length > 0){
      return res.json({
        status: false,
        message: "No such Invoice found",
        data: null
      })
    }


    const retailer = await Retailer.find({retailer_code : req.body.invoice['retailer_code']})

    const orderid = await Order.find({orderId : req.body.invoice['orderid']})

    if(!orderid.length == 1){

      return res.json({
        status: false,
        message: "Cannot find any order with this order ID!.",
        data: null
      })      

    }else if(!retailer.length == 1){

      return res.json({
        status: false,
        message: "Cannot find any retailer with this Retailer code !.",
        data: null
      })

    }

    const updatedInovice = await RetailerInvoice.findOneAndUpdate({_id: req.params.id}, req.body.invoice)

    return res.json({
      status: true,
      message: "Invoice updated successfully",
      data: updatedInovice
    })

  }catch(err){
    
    return res.json({
      status: false,
      message: err.message,
      data: null
    })
    
  }
})

// ================delete a specific style===================


router.post("/delete/:id", auth, async(req, res)=>{
  try{

    const retailerInvoice = await RetailerInvoice.find({_id: req.params.id})
    if(retailerInvoice.length > 0 ){
      
    await RetailerInvoice.deleteOne({_id: req.params.id});
    
    return res.json({
      status: true,
      message: "Invoice deleted successfully!",
      data: null
    })
  }else{
    return res.json({
      status: false,
      message: "No Invoice found with this ID!",
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

router.post("/fetchPaginate", auth, async (req, res) => {
  try {
    let page = req.query.page;
    let limit = req.query.limit;
    let retailer_code = req.query.retailer_code;

    let query = {};

    if (retailer_code && retailer_code !== "null") {
      query = { retailer_code: new RegExp(`${retailer_code}+`, "i") }
    }

    const paginated = await RetailerInvoice.paginate(
      query,
      {
        page,
        limit,
        lean: true,
        populate: "orders",
        sort: { date: -1 }
      }
    );

    const { docs } = paginated;
    const data = await Promise.all(docs.map(InvoiceSerializer));

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




const upload = multer();

router.post("/send-email", upload.single("file"), async (req, res) => {
    const { buffer, originalname } = req.file;

    // Configure Nodemailer
    let transporter = nodemailer.createTransport({      
      host: 'smtp.gmail.com',
      port: 465,
        auth: {
          user: 'sanjcreations@gmail.com',
          pass: 'ayluoprkxhholvgw'
        },
    });

    // Email options
    const mailOptions = {
        from: "<sanjcreations@gmail.com>",
        to: req.body.email,
        subject: "Your PDF Invoice",
        text: "Here is your PDF invoice!",
        attachments: [
            {
                filename: originalname,
                content: buffer,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send("Email sent successfully!");
    } catch (error) {
        console.error("Email sending failed:", error);
        res.status(500).send("Failed to send email.");
    }
});

module.exports = router