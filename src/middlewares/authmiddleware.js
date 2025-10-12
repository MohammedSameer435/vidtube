import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js"
import { apierror } from "../utils/apierror.js"
import { asyncHandler } from "../utils/asynchandler.js"

export const verifyJWT = asyncHandler(async(req,__, next) =>{
    const token = req.cookies.accessToken || req.header
    ("Authorization").replace("Bearer ", "")
    if(!token){
        throw new apierror(401, "Unauthorized")
    }
    try {
        const decodeToken=jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user= await User.findById(decodeToken?._id).select("-password -refreshToken")
        req.user=user
        next()
    } catch (error) {
        throw new apierror(401, error?.message|| "Invalidate access token")
    }
})

export {verifyJWT}
