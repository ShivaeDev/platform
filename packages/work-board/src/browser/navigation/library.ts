import { Schema } from "effect";

export const LibraryInput = {
	folder: Schema.optional(Schema.String),
	kind: Schema.optional(Schema.String),
	showFleet: Schema.optional(Schema.Boolean),
	status: Schema.optional(Schema.String),
};
export const LibraryFile = Schema.Struct({
	href: Schema.String,
	kind: Schema.String,
	modified: Schema.Number,
	path: Schema.String,
	status: Schema.String,
	title: Schema.String,
});
export type LibraryFile = typeof LibraryFile.Type;
export const Library = Schema.Struct({
	files: Schema.Array(LibraryFile),
	fleetCount: Schema.Number,
	folders: Schema.Array(Schema.Struct({ count: Schema.Number, name: Schema.String, path: Schema.String })),
	kinds: Schema.Array(Schema.String),
	statuses: Schema.Array(Schema.String),
});
export type Library = typeof Library.Type;
