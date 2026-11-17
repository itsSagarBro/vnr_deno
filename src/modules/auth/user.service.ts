import { UserModel } from "./user.model.ts";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string;
}

/// Kept as an interface so route tests can use an in-memory implementation.
export interface UserService {
  findByEmail(email: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
}

interface UserDoc {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
  name?: string;
}

function toRecord(doc: UserDoc): UserRecord {
  return {
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    ...(doc.name ? { name: doc.name } : {}),
  };
}

export const mongoUserService: UserService = {
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email }).lean();
    return doc ? toRecord(doc as unknown as UserDoc) : null;
  },

  async create(input) {
    const doc = await UserModel.create(input);
    return toRecord(doc as unknown as UserDoc);
  },
};
