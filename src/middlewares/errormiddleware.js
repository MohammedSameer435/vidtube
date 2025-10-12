import mongoose from "mongoose";
import { apierror } from "../utils/apierror.js"

const errorHandler =(err,req,res,next) => {
    let error =err
    if(!(error instanceof apierror)){
        const statusCode=error.statusCode || error instanceof mongoose.Error? 400:500
        const message =error.message
        error = new apierror(statusCode, message, error?.errors
            || [], err.stack
        )
    }

    const response = {
        ...error,
        message: error.message,
        ...apierror(process.env.NODE_ENV === "development" ? { stack:
            error.stack}:{}
        )
    }
    return res.status(error.statusCode).json(response)
}

export {errorHandler}