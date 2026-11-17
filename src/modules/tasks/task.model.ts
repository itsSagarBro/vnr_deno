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

/// Mongoose schema for tasks. Mirrors the Flutter `TaskItem` entity.
const taskSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [...TASK_CATEGORIES],
      default: "Personal",
      index: true,
    },
    description: { type: String, trim: true },
    dueDate: { type: Date },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/// Reuse the model on watch reloads to avoid OverwriteModelError.
export const TaskModel = mongoose.models.Task ??
  mongoose.model("Task", taskSchema);
