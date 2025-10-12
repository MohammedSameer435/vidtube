import dotenv from "dotenv";
import path from "path";
import connectdb from "./db/index.js";  // <-- no curly braces here
import { app } from "./app.js";

dotenv.config({
  path: "./.env",
});

const port = process.env.PORT || 3000;
console.log("MONGO_URI is:", process.env.MONGO_URI);

connectdb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is listening on port: ${port}`);
    });
  })
  .catch((err) => {
    console.log("Mongodb connection error", err);
  });
