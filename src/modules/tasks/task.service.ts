import { badRequest, notFound } from "../../shared/http/http-error.ts";
import { TASK_CATEGORIES, type TaskCategory, TaskModel } from "./task.model.ts";

export interface TaskInput {
  title: string;
  category: TaskCategory;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
}

export interface TaskRecord extends TaskInput {
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

export interface TaskService {
  list(params: ListParams): Promise<TaskRecord[]>;
  upsert(params: {
    userId: string;
    id: string;
    input: TaskInput;
  }): Promise<TaskRecord>;
  patch(params: {
    userId: string;
    id: string;
    changes: Partial<TaskInput>;
  }): Promise<TaskRecord>;
  softDelete(params: { userId: string; id: string }): Promise<TaskRecord>;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

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

function readOptionalDate(
  body: Record<string, unknown>,
  field: string,
): string | null {
  const value = body[field];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw badRequest(`'${field}' must be an ISO date.`, { field });
  }
  return new Date(value).toISOString();
}

function readCategory(value: unknown): TaskCategory {
  if (typeof value !== "string" || !TASK_CATEGORIES.includes(value as TaskCategory)) {
    throw badRequest("'category' is not supported.", { field: "category" });
  }
  return value as TaskCategory;
}

function readBoolean(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== "boolean") {
    throw badRequest(`'${field}' must be a boolean.`, { field });
  }
  return value;
}

export function parseTaskInput(body: unknown): TaskInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("A JSON object is required.");
  }
  const data = body as Record<string, unknown>;
  return {
    title: readString(data, "title"),
    category: readCategory(data.category ?? "Personal"),
    // Flutter calls this field `note`; the wire model uses `description`.
    description: readOptionalString(data, "description") ??
      readOptionalString(data, "note"),
    dueDate: readOptionalDate(data, "dueDate"),
    isCompleted: readBoolean(data, "isCompleted"),
  };
}

export function parseTaskPatch(body: unknown): Partial<TaskInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("A JSON object is required.");
  }
  const data = body as Record<string, unknown>;
  const changes: Partial<TaskInput> = {};
  if ("title" in data) changes.title = readString(data, "title");
  if ("category" in data) changes.category = readCategory(data.category);
  if ("description" in data || "note" in data) {
    changes.description = readOptionalString(data, "description") ??
      readOptionalString(data, "note");
  }
  if ("dueDate" in data) changes.dueDate = readOptionalDate(data, "dueDate");
  if ("isCompleted" in data) {
    changes.isCompleted = readBoolean(data, "isCompleted");
  }
  return changes;
}

interface TaskRow {
  _id: string | { toString(): string };
  title: string;
  category: TaskCategory;
  description?: string | null;
  dueDate?: Date | string | null;
  isCompleted?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRecord(row: TaskRow): TaskRecord {
  return {
    id: row._id.toString(),
    title: row.title,
    category: row.category,
    description: row.description ?? null,
    dueDate: iso(row.dueDate),
    isCompleted: row.isCompleted ?? false,
    createdAt: iso(row.createdAt) ?? iso(row.updatedAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
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
export const mongoTaskService: TaskService = {
  async list({ userId, updatedAfter, limit }) {
    const filter: Record<string, unknown> = { userId };
    const after = parseUpdatedAfter(updatedAfter ?? null);
    if (after) filter.updatedAt = { $gt: after };

    const rows = await TaskModel.find(filter)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();
    return (rows as unknown as TaskRow[]).map(toRecord);
  },

  async upsert({ userId, id, input }) {
    const row = await TaskModel.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          _id: id,
          userId,
          title: input.title,
          category: input.category,
          description: input.description,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          isCompleted: input.isCompleted,
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
    return toRecord(row as unknown as TaskRow);
  },

  async patch({ userId, id, changes }) {
    const existing = await TaskModel.findOne({
      _id: id,
      userId,
      deletedAt: null,
    }).lean();
    if (!existing) throw notFound("Task not found.", { field: "id" });

    const row = existing as unknown as TaskRow;
    return this.upsert({
      userId,
      id,
      input: {
        title: changes.title ?? row.title,
        category: changes.category ?? row.category,
        description: changes.description ?? row.description ?? null,
        dueDate: changes.dueDate === undefined ? iso(row.dueDate) : changes.dueDate,
        isCompleted: changes.isCompleted ?? row.isCompleted ?? false,
      },
    });
  },

  async softDelete({ userId, id }) {
    const row = await TaskModel.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    ).lean();
    if (!row) throw notFound("Task not found.", { field: "id" });
    return toRecord(row as unknown as TaskRow);
  },
};

export { parseListLimit };
