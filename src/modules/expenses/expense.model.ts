import mongoose from "mongoose";

/// Mongoose schema for expenses. Fields mirror the Flutter `Expense` entity.
const expenseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

/// Reuse the model on watch reloads to avoid OverwriteModelError.
export const ExpenseModel = mongoose.models.Expense ??
  mongoose.model("Expense", expenseSchema);
