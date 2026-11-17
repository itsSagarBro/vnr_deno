import mongoose from "mongoose";

/// Allowed task categories, shared by the API and the Flutter client.
export const TASK_CATEGORIES = [
  "Personal",
  "Work",
  "Travel",
  "Food",
  "Other",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/// Client-generated UUIDs are used as _id so offline retries are idempotent.
const taskSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [...TASK_CATEGORIES],
      default: "Personal",
      index: true,
    },
    description: { type: String, trim: true, default: null },
    dueDate: { type: Date, default: null },
    isCompleted: { type: Boolean, default: false },
    /// Soft delete: tombstones are returned by the sync list endpoint.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

taskSchema.index({ userId: 1, updatedAt: 1 });

/// Reuse the model on watch reloads to avoid OverwriteModelError.
export const TaskModel = mongoose.models.Task ??
  mongoose.model("Task", taskSchema);
