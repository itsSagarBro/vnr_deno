import { ExpenseModel } from "../expenses/expense.model.ts";
import { TaskModel } from "../tasks/task.model.ts";

export type SearchResultType = "expense" | "task";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  detail: string;
  date: string;
}

export interface SearchParams {
  userId: string;
  query: string;
  limit: number;
}

export type SearchService = (params: SearchParams) => Promise<SearchResult[]>;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ExpenseRow {
  _id: { toString(): string };
  title: string;
  category?: string;
  note?: string;
  date?: Date;
  updatedAt?: Date;
}

interface TaskRow {
  _id: { toString(): string };
  title: string;
  category?: string;
  description?: string;
  isCompleted?: boolean;
  updatedAt?: Date;
}

/// Searches the authenticated user's expenses and tasks, then merges the
/// results newest-first. Regex input is escaped to avoid pattern injection.
export const globalSearch: SearchService = async (
  { userId, query, limit },
) => {
  const pattern = new RegExp(escapeRegex(query), "i");

  const [expenseRows, taskRows] = await Promise.all([
    ExpenseModel.find({
      userId,
      $or: [{ title: pattern }, { category: pattern }, { note: pattern }],
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean(),
    TaskModel.find({
      userId,
      $or: [{ title: pattern }, { description: pattern }],
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const expenses: SearchResult[] = (expenseRows as unknown as ExpenseRow[]).map(
    (row) => ({
      type: "expense",
      id: row._id.toString(),
      title: row.title,
      detail: [row.category, row.note].filter(Boolean).join(" · "),
      date: (row.date ?? row.updatedAt ?? new Date()).toISOString(),
    }),
  );

  const tasks: SearchResult[] = (taskRows as unknown as TaskRow[]).map((row) => ({
    type: "task",
    id: row._id.toString(),
    title: row.title,
    detail: [row.category, row.description?.trim()]
      .filter(Boolean)
      .join(" · ") || (row.isCompleted ? "Completed" : "Open"),
    date: (row.updatedAt ?? new Date()).toISOString(),
  }));

  return [...expenses, ...tasks]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limit);
};
