import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import healthCheckRouter from "./routes/healthcheckroutes.js"
import userRouter from "./routes/userroutes.js"
import { errorHandler } from "./middlewares/errormiddleware.js"

const app = express()

//common middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended : true, limit:"16kb"}))
app.use(express.static("public"))
//app.use(errorHandler)


app.use('/api/v1/healthcheck',healthCheckRouter)
app.use("/api/v1/users", userRouter)

export {app}