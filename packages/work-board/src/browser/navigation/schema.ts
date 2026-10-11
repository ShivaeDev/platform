import { Schema } from "effect";

export const NavigationFile = Schema.Struct({
	current: Schema.Boolean,
	href: Schema.String,
	modified: Schema.Number,
	name: Schema.String,
	path: Schema.String,
});
export type NavigationFile = typeof NavigationFile.Type;

export class NavigationFolder extends Schema.Class<NavigationFolder>("NavigationFolder")({
	active: Schema.Boolean,
	count: Schema.Number,
	files: Schema.Array(NavigationFile),
	folders: Schema.Array(Schema.suspend((): Schema.Codec<NavigationFolder> => NavigationFolder)),
	name: Schema.String,
	path: Schema.String,
}) {}

export const Navigation = Schema.Struct({
	inboxCount: Schema.NullOr(Schema.Number),
	records: Schema.Struct({ active: Schema.Boolean, count: Schema.Number, files: Schema.Array(NavigationFile) }),
	tree: NavigationFolder,
});
export type Navigation = typeof Navigation.Type;
