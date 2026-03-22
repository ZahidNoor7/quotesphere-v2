import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  if (isConnected && mongoose.connections[0].readyState === 1) return;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined");

  try {
    await mongoose.connect(uri, {
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4,
    });
    isConnected = true;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}
