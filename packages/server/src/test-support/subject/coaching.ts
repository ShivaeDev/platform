import { Effect, Layer, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { delegatedSubject, Subject } from "@shivaedev/identity/subject.ts";
import type { AppModule } from "#AppModule.ts";
import { CoachDelegation } from "#test/subject/coach-delegation/service.ts";

export class NotYourClient extends Schema.TaggedError<NotYourClient>()("NotYourClient", { client: Schema.String }) {}
export class DiaryPrivate extends Schema.TaggedError<DiaryPrivate>()("DiaryPrivate", { client: Schema.String }) {}

export const actsAsCoach = delegatedSubject({
	deny: (client) => new NotYourClient({ client }),
	refusal: NotYourClient,
	service: "@shivaedev/server/test/subject/CoachDelegation",
});

const notes = collection("coaching_notes", Schema.String);

const storedNote = Effect.fnUntraced(function* (column: "note" | "diary") {
	const { id } = yield* Subject;
	const sql = yield* SqlClient.SqlClient;
	const [row] = yield* sql<{ text: string }>`select ${sql(column)} as text from coaching_notes where client = ${id}`.pipe(Effect.orDie);
	return `${id}: ${row?.text ?? "nothing yet"}`;
});

const Note = query("note", {
	reads: () => [notes.list],
	*run() {
		return yield* storedNote("note");
	},
});

// The module lets a coach read; this query also refuses anyone but the client, on top of that rule.
const Diary = query("diary", {
	reads: () => [notes.list],
	*run() {
		const { id } = yield* Subject;
		const actor = yield* Identity;
		if (actor.id !== id) {
			return yield* new DiaryPrivate({ client: id });
		}
		return yield* storedNote("diary");
	},
});

const Write = command("write", {
	invalidates: () => [notes.list],
	payload: { note: Schema.String },
	*run({ note }) {
		const { id } = yield* Subject;
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into coaching_notes (client, note, diary) values (${id}, ${note}, '') on conflict (client) do update set note = excluded.note`.pipe(
			Effect.orDie,
		);
		return `${id}: ${note}`;
	},
});

export const Coaching = defineModule({
	name: "coaching",
	operations: [Note, Diary, Write],
	subject: actsAsCoach,
	wire: {
		diary: { rejections: { DiaryPrivate }, success: Schema.String },
		note: { rejections: {}, success: Schema.String },
		write: { rejections: {}, success: Schema.String },
	},
});

const migrations = {
	loader: Migrator.fromRecord({
		"001_coaching": SqlClient.SqlClient.use((sql) =>
			sql`create table coaching_notes (client text primary key, note text not null, diary text not null)`.pipe(
				Effect.andThen(sql`create table coaching_assignments (coach text not null, client text not null)`),
			),
		),
	}),
};

export const coachingModule = { migrations, module: Coaching, services: CoachDelegation.layer } satisfies AppModule;

// The same module registered by an application that forgot the delegation rule's service.
export const coachingWithoutRule = { migrations, module: Coaching, services: Layer.empty } satisfies AppModule;
