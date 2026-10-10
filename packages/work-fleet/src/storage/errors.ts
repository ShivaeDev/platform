import { Schema } from "effect";
import type { SqlError } from "effect/unstable/sql/SqlError";
export class StorageConflict extends Schema.TaggedError<StorageConflict>()("StorageConflict", {
	actualVersion: Schema.NullOr(Schema.Number),
	expectedVersion: Schema.NullOr(Schema.Number),
	workId: Schema.String,
}) {}

export class StorageOwnershipConflict extends Schema.TaggedError<StorageOwnershipConflict>()("StorageOwnershipConflict", {
	owner: Schema.String,
	path: Schema.String,
	workId: Schema.String,
}) {}

export class StorageCapacity extends Schema.TaggedError<StorageCapacity>()("StorageCapacity", {
	kind: Schema.Literals(["execution", "backlog"]),
	limit: Schema.Number,
}) {}

export class StorageInvalidPath extends Schema.TaggedError<StorageInvalidPath>()("StorageInvalidPath", { path: Schema.String }) {}

export class StorageQuota extends Schema.TaggedError<StorageQuota>()("StorageQuota", {
	available: Schema.Number,
	observedAt: Schema.Number,
	reason: Schema.Literals(["exhausted", "unconfigured"]),
	submitted: Schema.optional(Schema.Number),
}) {}

export type StorageError =
	| SqlError
	| Schema.SchemaError
	| StorageConflict
	| StorageOwnershipConflict
	| StorageCapacity
	| StorageInvalidPath
	| StorageQuota;
