import  {APIresponse}  from "../utils/APIresponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const healthcheck = asyncHandler(async(req,res)=>{
    res.status(200).json(
        new APIresponse(200,{message:"Server is running"})
    )
})
export {healthcheck}