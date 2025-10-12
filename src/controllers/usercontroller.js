
import { asyncHandler } from "../utils/asynchandler.js"
import { apierror } from "../utils/apierror.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { APIresponse } from "../utils/APIresponse.js"
import { access } from "fs/promises"
import { http, loggers } from "winston"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessandRefreshToken = async(userId) =>{
    const user =User.findById(userId)
    if(!user){
        throw new apierror(401, "Could not find the User by this userId")
    }
    try {
        const accessToken =user.generateAccessToken()
        const refreshToken =user.generateRefreshToken()
    
        user.refreshToken =refreshToken
        await user.schemaLevelProjections({validateBeforeSave: false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new apierror(500, "Something went wrong while generating refresh and access Tokens")
    }
}


const registerUser = asyncHandler(async(req,res) => {
    const {fullname,email,username,password}=req.body
    //validation
    if(
        [fullname, username, email, password].some((field) => field?.trim() === "")
    ){
        throw new apierror(400,"All fields are required")
    }
    const existedUser = await User.findOne({
        $or : [{username},{email}]
    })
    if(existedUser){
        throw new apierror(409, "User with email or username already exists")
    }
    const avatarLocalPath=req.files?.avatar?.[0]?.path
    const coverLocalPath=req.files?.coverImage?.[0]?.path
    if(!avatarLocalPath){
        throw new apierror(400, "Avatar file is missing")
    }

    //const avatar= await uploadOnCloudinary(avatarLocalPath)
    //const coverImage = await uploadOnCloudinary(coverLocalPath)

    let avatar
    try {
        avatar=await uploadOnCloudinary(avatarLocalPath)
        console.log("Uploaded Avatar")
    } catch (error) {
        console.log("Error uploading avatar",error)
        throw new apierror(400, "Failed to upload Avatar file")
    }

    let coverImage
    try {
        coverImage=await uploadOnCloudinary(coverLocalPath)
        console.log("Uploaded coverImage")
    } catch (error) {
        console.log("Error uploading coverImage",error)
        throw new apierror(400, "Failed to upload coverImage file")
    }

    try {
        const user = await User.create({
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })
    
        const createdUser =await User.findById(user._id).select("-password -refreshToken")
    
        if(!createdUser){
            throw new apierror(500, "Something went wrong while registering a user and images are deleted")
        }
        return res
        .status(201)
        .json( new APIresponse(200,createdUser,"User registered successfully"))
    } catch (error) {
        console.log("user creation is failed")

        if(avatar){
            await deleteFromCloudinary(avatar.public_id)
        }
        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id)
        }
    }
})

const loginUser = asyncHandler (async (req,res) =>{
    //get data from req body
    const {email, username,password} =req.body
    //validation
    if(!email){
        throw new apierror(400, "Email is required")
    }
    const user = await User.findOne({
        $or : [{username},{email}]
    })
    if(!user){
        throw new apierror(404, "User not found")
    }
    //validate password
    const isPasswordvalid= await user.isPasswordCorrect(password)
    if(!isPasswordvalid){
        throw new apierror(401,"Invalid credentials")
    }
    const {accessToken,refreshToken}= 
    await generateAccessandRefreshToken(user._id)

    const loggedInUser= await user.findById(user._id)
      .select("-password -refreshToken")
      
      if(!loggedInUser){
        throw new apierror(400, "User is not logged in")
      }
    const options = {
        httpOnly:true,
        secure: process.env.NODE_ENV === "production"
    }
    return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", refreshToken, options)
     .json( new APIresponse(
        200, 
        {user:loggedInUser,accessToken,refreshToken},
        "User logged in successfully"))
})

const logoutuser = asyncHandler(async (req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {new:true}
    )
    const options={
        httpOnly:true,
        secure: process.env.NODE_ENV==="production"
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apierror(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingrefreshToken){
        throw new apierror(401, "Refresh Token is required")
    }
    try {
        const decodedTOken = jwt.verify(incomingrefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user= await User.findById(decodedTOken?._id)
        if(!user){
            throw new apierror(404, "Invalid refresh token")
        }
        if(user.refreshToken!=user?.refreshToken){
            throw new apierror(404, "Invalid refresh token")
        }
        const options = {
            httpOnly:true,
            secure: process.env.NODE_ENV ==="production"
        }
        const {accessToken, newRefreshToken}=await generateAccessandRefreshToken(user._id)

        return res 
          .status(200)
          .cookie("accessToken", accessToken, options)
          .cookie("refreshToken", newRefreshToken, options)
          .json(new APIresponse(200, {accessToken,
            refreshToken:  newRefreshToken},
            "Access Token refreshed successfully"
        ))
    } catch (error) {
        throw new apierror(400,"Something went wrong refreshing accesstoken")
    }
})

const changeCurrrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} =req.body
    const user = await User.findById(req.user.User._id)
    const isPasswordvalid=await user.isPasswordCorrect(oldPassword)
    if(!isPasswordvalid){
        throw new apierror(401, "old password is incorrect")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new APIresponse(200,{}, "password changed successfully"))
})
const getCurrrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(new APIresponse(200, req.user, "current user details"))
})
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname, email}=req.body
    if(!email || !fullname){
        throw new apierror(400, "Fullname and email are required")
    }
    

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password -refreshToken")
    return res.status(200).json(new APIresponse(200, user,"Account details updated successfully"))
})
const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath= req.files?.path
    if(!avatarLocalPath){
        throw new apierror(400, "no path of avatar")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new apierror(500, "somethng went wrong while uploading avatar")

    }
    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}

    ).select("-password -refreshToken")

    res.status(200).json(new APIresponse(200, user, "Avatar updated successfully"))
})
const updatecoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath){
        throw new apierror(400,"file is required")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new apierror(500, "Something went wrong while uploading cover Image")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res.status(200).json(new APIresponse(200, user,"cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
        throw new apierror(400, "Username is required");
    }

    const currentUserId = req.user?._id;

    const channelData = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",      // Collection to join
                localField: "_id",          // User's _id
                foreignField: "channel",    // "channel" field in subscriptions
                as: "subscribers"           // Output array
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $in: [ currentUserId, "$subscribers.subscriber" ]
                }
            }
        },
        {
            $project: {
                fullname:1,
                username:1,
                avatar:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                coverImage:1,
                email:1,
                password: 0,           // Hide sensitive data
                refreshToken: 0
            }
        }
    ]);

    if (!channelData || channelData.length === 0) {
        throw new apierror(404, "User not found");
    }

    res.status(200).json(
        new APIresponse(200, channelData[0], "User channel profile fetched")
    );
});

const getWatchHistory = asyncHandler(async(req,res) =>{
    const user = await User.aggregate([
        {
            $match:{
                _id: req.user?._id

            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                },
                                {
                                    $addFields:{
                                        owner:{
                                            $first:"$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]

            }
        }
    ])
    return res.status(200).json(new APIresponse(200, user[0]?.watchHistory, "Watch history fetched successfully"))
})

export {registerUser, loginUser, refreshAccessToken, logoutuser,changeCurrrentPassword,getCurrrentUser,updateAccountDetails,updateUserAvatar,updatecoverImage,getUserChannelProfile,getWatchHistory}