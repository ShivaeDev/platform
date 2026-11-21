import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ColumnKey, type ColumnKeyError } from "#ColumnKey.ts";
import { clientOptions } from "#clientOptions.ts";
import { encrypted } from "#encrypted.ts";
import { makeOrderedChildren } from "#makeOrderedChildren.ts";
import { owner } from "#owner.ts";
import { collectRepositoryModels, RepositoryModels } from "#RepositoryModels.ts";
import { makeRepository } from "#repository.ts";
import type { RepositoryBuildError } from "#repositoryCollection.ts";
import { serverOnly } from "#serverOnly.ts";

class Note extends Model.Class<Note>("OwnedNote")({
	authorId: owner(bucket(Schema.String)),
	id: Schema.Number,
	title: Schema.String,
}) {}

class NoteHeading extends Model.Class<NoteHeading>("OwnedNoteHeading")({
	authorId: owner(Schema.String),
	id: Schema.Number,
}) {}

class Step extends Model.Class<Step>("OwnedStep")({
	checklistId: Schema.Number,
	id: Schema.Number,
	position: Schema.Number,
	userId: owner(Schema.NullOr(Schema.String)),
}) {}

class Tag extends Model.Class<Tag>("UnownedTag")({
	id: Schema.Number,
	name: Schema.String,
}) {}

class CoAuthored extends Model.Class<CoAuthored>("CoAuthoredNote")({
	authorId: owner(Schema.String),
	editorId: owner(Schema.String),
	id: Schema.Number,
}) {}

// owner() takes a schema, so a server-only field can carry the mark only when its select variant is annotated by hand.
const serverOnlyOwner = Model.Field({
	...serverOnly(Schema.String).schemas,
	select: serverOnly(Schema.String).schemas.select.annotate({ "@shivaedev/sql/owner": true }),
});

const encryptedOwner = Model.Field({
	...encrypted(Schema.String).schemas,
	select: encrypted(Schema.String).schemas.select.annotate({ "@shivaedev/sql/owner": true }),
});

class SealedOwner extends Model.Class<SealedOwner>("SealedOwnerNote")({
	id: Schema.Number,
	ownerToken: encryptedOwner,
}) {}

class HiddenOwner extends Model.Class<HiddenOwner>("HiddenOwnerNote")({
	id: Schema.Number,
	ownerToken: serverOnlyOwner,
}) {}

const models = new Map<Model.Any, string>([
	[CoAuthored, "CoAuthored"],
	[HiddenOwner, "HiddenOwner"],
	[SealedOwner, "SealedOwner"],
	[Note, "Note"],
	[NoteHeading, "NoteHeading"],
	[Step, "Step"],
	[Tag, "Tag"],
]);

export type Built =
	| "checklist steps through makeOrderedChildren"
	| "co-authored notes with two owner fields"
	| "note headings over the archived notes table"
	| "note headings over the notes table"
	| "notes keyed by tableName in place of their collection"
	| "notes owned by a server-only token"
	| "notes owned by an encrypted token"
	| "notes owned by their author bucket"
	| "unowned note tags";

const repositories: Record<Built, () => Effect.Effect<unknown, RepositoryBuildError | ColumnKeyError, SqlClient.SqlClient | ColumnKey>> = {
	"checklist steps through makeOrderedChildren": () =>
		makeOrderedChildren(Step, { parentColumn: "checklistId", parentTable: "checklists", positionColumn: "position", tableName: "checklist_steps" }),
	"co-authored notes with two owner fields": () => makeRepository(CoAuthored, { tableName: "co_authored_notes" }),
	"note headings over the archived notes table": () => makeRepository(NoteHeading, { tableName: "archived_notes" }),
	"note headings over the notes table": () => makeRepository(NoteHeading, { tableName: "notes" }),
	"notes keyed by tableName in place of their collection": () => makeRepository(Note, { tableName: "notes" }),
	"notes owned by a server-only token": () => makeRepository(HiddenOwner, { tableName: "hidden_owner_notes" }),
	"notes owned by an encrypted token": () => makeRepository(SealedOwner, { tableName: "sealed_owner_notes" }),
	"notes owned by their author bucket": () => makeRepository(Note, { collection: collection("notes", Schema.Number, { authorId: Schema.String }) }),
	"unowned note tags": () => makeRepository(Tag, { tableName: "noteTags" }),
};

// Repositories report to sql's own collector, as they do outside a host; the encrypted owner is refused before its repository would load a key.
const snakeCaseSqlite = Layer.mergeAll(
	SqliteClient.layer(clientOptions({ filename: ":memory:" })),
	Reactivity.layer,
	Layer.fresh(collectRepositoryModels),
	ColumnKey.fromConfig,
);

export const ownerMarks = storyKit({
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(snakeCaseSqlite)),
	clock: "test",
	create: () => ({}),
	layer: snakeCaseSqlite,
	name: "repository owner marks on a snake-case client",
	stages: [],
	verbs: (_engine, story) => ({
		build: (repository: Built) =>
			Effect.suspend(() => {
				story.tell(`the repository of ${repository} is built on the collecting Layer`);
				return repositories[repository]().pipe(Effect.match({ onFailure: (error) => `${error._tag}: ${error.message}`, onSuccess: () => "built" }));
			}),
		owned: () =>
			Effect.gen(function* () {
				const collected = yield* (yield* RepositoryModels).owned;
				return collected.map((entry) => ({ model: models.get(entry.model) ?? "an unknown model", owner: entry.owner, table: entry.table }));
			}),
	}),
});
