import { Effect, Layer, Option, Schema } from "effect";
import type { RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import type { AppModule } from "#AppModule.ts";
import { replacedModuleHandlers } from "#test/replacedModuleHandlers.ts";

const notes = collection("defined_notes", Schema.Number);
const drafts = collection("module_drafts", Schema.String);
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", { message: Schema.String }) {}
export class DraftMissing extends Schema.TaggedError<DraftMissing>()("DraftMissing", { message: Schema.String }) {}

const Create = command("create", {
	payload: { title: Schema.String },
	rejections: { TitleTaken },
	*run({ title }) {
		const sql = yield* SqlClient.SqlClient;
		const taken = yield* sql`select id from defined_notes where title = ${title}`;
		if (taken.length > 0) {
			return yield* new TitleTaken({ message: `A note titled ${title} exists` });
		}
		yield* sql`insert into defined_notes (title) values (${title})`;
		return title;
	},
	success: Schema.String,
});

const Get = query("get", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	rejections: { NotFound },
	*run({ id }) {
		const sql = yield* SqlClient.SqlClient;
		const [row] = yield* sql<{ title: string }>`select title from defined_notes where id = ${id}`;
		if (row === undefined) {
			return yield* new NotFound({ message: `Note ${id} not found` });
		}
		return row.title;
	},
	success: Schema.String,
});

export const Notes = defineModule({
	middleware: MaybeAuthenticated,
	name: "notes",
	operations: [Create, Get],
	requires: [SqlClient.SqlClient],
});

export const Drafts = contract("drafts", {
	queries: [
		query("read", {
			payload: { title: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: ({ title }) => [drafts.item(title)],
			rejections: { DraftMissing },
			success: Schema.String,
		}),
	],
});

const notesMigrations = {
	loader: Migrator.fromRecord({
		"001_defined_notes": SqlClient.SqlClient.use((sql) => sql`create table defined_notes (id serial primary key, title text not null)`),
	}),
};

export const draftsModule = {
	group: Drafts,
	handlers: Drafts.application.toLayer({
		"drafts.read": ({ title }) =>
			SqlClient.SqlClient.use((sql) => sql<{ title: string }>`select title from module_drafts where title = ${title}`).pipe(
				Effect.orDie,
				Effect.flatMap(([row]) =>
					Option.match(Option.fromUndefinedOr(row), {
						onNone: () => Effect.fail(new DraftMissing({ message: `No draft titled ${title}` })),
						onSome: (draft) => Effect.succeed(draft.title),
					}),
				),
			),
	}),
	migrations: {
		loader: Migrator.fromRecord({
			"002_module_drafts": SqlClient.SqlClient.use((sql) =>
				sql`create table module_drafts (title text not null)`.pipe(Effect.andThen(sql`insert into module_drafts values ('Plan')`)),
			),
		}),
	},
	name: "drafts",
	services: Layer.empty,
} satisfies AppModule;

export const notesModule = { migrations: notesMigrations, module: Notes, name: "notes", services: Layer.empty } satisfies AppModule;

const fakeNote = Notes.application.toLayer({
	"notes.create": ({ title }) => Effect.succeed(title),
	"notes.get": () => Effect.succeed("Fake note"),
});

// The old branch refuses `group: Notes` at compile time; a group widened to its RPCs is how hand-written handlers still reach the host.
const notesGroup: RpcGroup.RpcGroup<RpcGroup.Rpcs<typeof Notes>> = Notes;

export const handWrittenNotesModule = {
	group: notesGroup,
	handlers: fakeNote,
	migrations: notesMigrations,
	name: "notes",
	services: Layer.empty,
} satisfies AppModule;

export const replacedNotesModule = {
	...replacedModuleHandlers(Notes, fakeNote),
	migrations: notesMigrations,
	name: "notes",
	services: Layer.empty,
} satisfies AppModule;

export const Api = Drafts.merge(Notes);
