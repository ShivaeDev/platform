import { Schema } from "effect";
import type { Files } from "./snapshot.ts";

const Result = Schema.Struct({
	duration: Schema.optional(Schema.Number),
	errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
	startTime: Schema.optional(Schema.Number),
	state: Schema.Literals(["run", "skip", "only", "todo", "queued", "pass", "fail"]),
});

const TaskFields = {
	fullName: Schema.String,
	id: Schema.String,
	meta: Schema.Record(Schema.String, Schema.Unknown),
	mode: Schema.Literals(["run", "skip", "only", "todo", "queued"]),
	name: Schema.String,
	result: Schema.optional(Result),
};

const TaskTree: Schema.Codec<unknown> = Schema.suspend(() =>
	Schema.Union([
		Schema.Struct({ ...TaskFields, tasks: Schema.Array(TaskTree), type: Schema.Literal("suite") }),
		Schema.Struct({ ...TaskFields, fullTestName: Schema.String, type: Schema.Literal("test") }),
	]),
);

const FilesSchema = Schema.Array(
	Schema.Struct({
		...TaskFields,
		filepath: Schema.String,
		projectName: Schema.optional(Schema.String),
		tasks: Schema.Array(TaskTree),
		type: Schema.Literal("suite"),
	}),
);

// Decoding structs would copy the tree and break Vitest's circular file/suite references.
export const SnapshotFiles = Schema.declare<Files>((input): input is Files => Schema.is(FilesSchema)(input));
