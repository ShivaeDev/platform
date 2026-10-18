import { Schema } from "effect";
import type { SqlError } from "effect/sql/SqlError";
export class StorageConflict extends Schema.TaggedError<StorageConflict>()("StorageConflict", {
	actualVersion: Schema.NullOr(Schema.Number),
	expectedVersion: Schema.NullOr(Schema.Number),
	workId: Schema.String,
}) {}

export class StorageCapacity extends Schema.TaggedError<StorageCapacity>()("StorageCapacity", {
	kind: Schema.Literals(["execution", "backlog", "open-pull-requests", "merge-work"]),
	limit: Schema.Number,
	occupied: Schema.optional(Schema.Number),
}) {}

export class StorageQuota extends Schema.TaggedError<StorageQuota>()("StorageQuota", {
	available: Schema.Number,
	observedAt: Schema.Number,
	reason: Schema.Literals(["exhausted", "unconfigured"]),
	submitted: Schema.optional(Schema.Number),
}) {}

export class StorageAdmission extends Schema.TaggedError<StorageAdmission>()("StorageAdmission", { message: Schema.String }) {}

export type StorageError = StorageAdmission | SqlError | Schema.SchemaError | StorageConflict | StorageCapacity | StorageQuota;
