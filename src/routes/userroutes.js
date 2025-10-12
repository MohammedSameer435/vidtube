import {Router} from "express"
import { registerUser,logoutuser, loginUser, refreshAccessToken, changeCurrrentPassword, getCurrrentUser, getUserChannelProfile, updateAccountDetails, updateUserAvatar, updatecoverImage, getWatchHistory } from "../controllers/usercontroller.js"
import { upload } from "../middlewares/multer.js"
import { verifyJWT } from "../middlewares/authmiddleware.js"

const router =Router()

router.route("/register").post( 
    upload.fields(
        [{name:"avatar",
         maxCount:1
        },
        {
           name:"coverImage",
           maxCount:1 

        }]
    ),
        registerUser)

router.route('/login').post(loginUser)
router.route('/refresh_token').post(refreshAccessToken)
//secured
router.route("/logout",).post(verifyJWT,logoutuser)
router.route('change-password').post(verifyJWT,changeCurrrentPassword)
router.route('/current-user').get(verifyJWT,getCurrrentUser)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/avatar").patch(verifyJWT,upload.single('avatar'),updateUserAvatar)
router.route("/cover-image").patch(verifyJWT,upload.single('coverImage'),updatecoverImage)
router.route("/history").get(verifyJWT,getWatchHistory)

export default router