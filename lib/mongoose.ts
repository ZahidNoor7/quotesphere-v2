import mongoose from "mongoose";

export async function connectDB() {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  // Mongoose handles concurrent calls to connect() internally, so no custom flag needed
  if (mongoose.connection.readyState >= 1) return;

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
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}
