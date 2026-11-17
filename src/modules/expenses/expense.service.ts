import { badRequest, notFound } from "../../shared/http/http-error.ts";
import { ExpenseModel } from "./expense.model.ts";

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
}

export interface ExpenseRecord extends ExpenseInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListParams {
  userId: string;
  updatedAfter?: string;
  limit: number;
}

export interface ExpenseService {
  list(params: ListParams): Promise<ExpenseRecord[]>;
  upsert(params: {
    userId: string;
    id: string;
    input: ExpenseInput;
  }): Promise<ExpenseRecord>;
  softDelete(params: { userId: string; id: string }): Promise<ExpenseRecord>;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/// Client ids are UUIDs from Flutter, but stay permissive for existing data.
export function validateRecordId(id: unknown): string {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    throw badRequest("A valid record id is required.", { field: "id" });
  }
  return id;
}

function readString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest(`'${field}' is required.`, { field });
  }
  return value.trim();
}

function readOptionalString(
  body: Record<string, unknown>,
  field: string,
): string | null {
  const value = body[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw badRequest(`'${field}' must be a string.`, { field });
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readDate(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw badRequest(`'${field}' must be an ISO date.`, { field });
  }
  return new Date(value).toISOString();
}

export function parseExpenseInput(body: unknown): ExpenseInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("A JSON object is required.");
  }
  const data = body as Record<string, unknown>;
  const amount = data.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw badRequest("'amount' must be greater than zero.", { field: "amount" });
  }

  return {
    title: readString(data, "title"),
    amount,
    category: readString(data, "category"),
    date: readDate(data, "date"),
    note: readOptionalString(data, "note"),
  };
}

interface ExpenseRow {
  _id: string | { toString(): string };
  title: string;
  amount: number;
  category: string;
  date: Date | string;
  note?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRecord(row: ExpenseRow): ExpenseRecord {
  return {
    id: row._id.toString(),
    title: row.title,
    amount: row.amount,
    category: row.category,
    date: iso(row.date)!,
    note: row.note ?? null,
    createdAt: iso(row.createdAt) ?? iso(row.date)!,
    updatedAt: iso(row.updatedAt) ?? iso(row.date)!,
    deletedAt: iso(row.deletedAt),
  };
}

function parseListLimit(value: string | null): number {
  if (value === null) return 200;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw badRequest("'limit' must be an integer between 1 and 500.", {
      field: "limit",
    });
  }
  return parsed;
}

function parseUpdatedAfter(value: string | null): Date | undefined {
  if (value === null || value.trim() === "") return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw badRequest("'updatedAfter' must be an ISO date.", {
      field: "updatedAfter",
    });
  }
  return new Date(time);
}

/// Mongoose-backed implementation. Injected into routes by createApp(); route
/// tests use in-memory implementations instead.
export const mongoExpenseService: ExpenseService = {
  async list({ userId, updatedAfter, limit }) {
    const filter: Record<string, unknown> = { userId };
    const after = parseUpdatedAfter(updatedAfter ?? null);
    if (after) filter.updatedAt = { $gt: after };

    const rows = await ExpenseModel.find(filter)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();
    return (rows as unknown as ExpenseRow[]).map(toRecord);
  },

  async upsert({ userId, id, input }) {
    const row = await ExpenseModel.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          _id: id,
          userId,
          title: input.title,
          amount: input.amount,
          category: input.category,
          date: new Date(input.date),
          note: input.note,
          deletedAt: null,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();
    return toRecord(row as unknown as ExpenseRow);
  },

  async softDelete({ userId, id }) {
    const row = await ExpenseModel.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    ).lean();
    if (!row) throw notFound("Expense not found.", { field: "id" });
    return toRecord(row as unknown as ExpenseRow);
  },
};

export { parseListLimit };
