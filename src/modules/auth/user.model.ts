import mongoose from "mongoose";

/// Stored user document. Only the hash is persisted, never the password.
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
  },
  { timestamps: true },
);

/// Reuse the model on watch reloads to avoid OverwriteModelError.
export const UserModel = mongoose.models.User ??
  mongoose.model("User", userSchema);
