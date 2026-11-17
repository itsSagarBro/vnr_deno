import mongoose from "mongoose";

/// Single Mongoose connection shared by all models.
export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log("[e-track-api] MongoDB connected");
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[e-track-api] MongoDB disconnected");
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
