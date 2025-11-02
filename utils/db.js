import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

export default connectDB;