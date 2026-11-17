import mongoose from "mongoose";

/// Client-generated UUIDs are used as _id so offline retries are idempotent.
const expenseSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    note: { type: String, trim: true, default: null },
    /// Soft delete: tombstones are returned by the sync list endpoint.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

expenseSchema.index({ userId: 1, updatedAt: 1 });

/// Reuse the model on watch reloads to avoid OverwriteModelError.
export const ExpenseModel = mongoose.models.Expense ??
  mongoose.model("Expense", expenseSchema);
