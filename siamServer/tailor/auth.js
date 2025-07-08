const jwt = require("jsonwebtoken");
const Tailor = require("./../admin/model/factoryModel/model.tailor")


const auth = async(req, res, next) => {
  try{
    const token = req.headers.token
    const decode =jwt.verify(token, process.env.JWT_SECRET)
    const tailor = await Tailor.findOne({_id: decode.id}).populate('process_id')
    
    if(!tailor){

        return res.json({
            status: false,
            message: "Authentication Failure!",
            data: {}
        })
    }
    
    // console.log(tailor)
    req.tailor = tailor
    req.token = token 
    next()

}catch(e){
    return res.json({
        status: false,
        message: e.message,
        data: {}
    })
}
}

module.exports = auth