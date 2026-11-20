import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "#repository.ts";

class Bookmark extends Model.Class<Bookmark>("Bookmark")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	url: Schema.String,
	userId: bucket(Schema.String),
}) {}

class Setting extends Model.Class<Setting>("Setting")({
	key: Schema.String,
	value: Schema.String,
}) {}

const bookmarks = collection("bookmarks", Schema.Number, { userId: Schema.String });

it("a collection names the table, so tableName is refused beside it, and a repository without one still names its table", () => {
	makeRepository(Bookmark, { collection: bookmarks });
	makeRepository(Bookmark, { tableName: "bookmarks" });
	// @ts-expect-error A collection names the table; tableName beside it would be a second name.
	makeRepository(Bookmark, { collection: bookmarks, tableName: "bookmarks" });
	// @ts-expect-error A repository without a collection names its table.
	makeRepository(Bookmark, {});
	// @ts-expect-error Repositories with conflict writes follow the same rule.
	makeRepository(Bookmark, { collection: bookmarks, conflictColumns: ["url"], tableName: "bookmarks" });
});

it("the ID column defaults to id and keys the repository by it, while a model without an id field must name its ID column", () => {
	const program = Effect.map(makeRepository(Bookmark, { collection: bookmarks }), (repository) => repository.findById);
	expectTypeOf<Parameters<Effect.Success<typeof program>>[0]>().toEqualTypeOf<number>();
	makeRepository(Setting, { idColumn: "key", tableName: "settings" });
	// @ts-expect-error Setting has no id field, so its repository must name its ID column.
	makeRepository(Setting, { tableName: "settings" });
});

class Tag extends Model.Class<Tag>("Tag")({
	id: Schema.Number,
	slug: Schema.String,
}) {}

it("a model with id and another key column keys its repository by id unless it names the other column", () => {
	const byDefault = Effect.map(makeRepository(Tag, { tableName: "tags" }), (repository) => repository.findById);
	expectTypeOf<Parameters<Effect.Success<typeof byDefault>>[0]>().toEqualTypeOf<number>();
	const bySlug = Effect.map(makeRepository(Tag, { idColumn: "slug", tableName: "tags" }), (repository) => repository.findById);
	expectTypeOf<Parameters<Effect.Success<typeof bySlug>>[0]>().toEqualTypeOf<string>();
});
