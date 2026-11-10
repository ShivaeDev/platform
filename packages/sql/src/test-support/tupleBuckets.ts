import { Effect, Order, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { type Capture, makeCapture } from "@shivaedev/changes/capture.ts";
import { collection, readKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "#test/engines.ts";
import { ChangeObserver } from "#transact.ts";

class DiaryEntry extends Model.Class<DiaryEntry>("DiaryEntry")({
	day: Schema.NullOr(Schema.Number),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.String,
	ownerId: bucket(Schema.String),
}) {}

type Day = number | null;

function dayWords(day: Day) {
	return day === null ? "no day" : `day ${day}`;
}

function diaryKeys(tableName: string) {
	return collection(tableName, Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });
}

interface TupleBucketsEngine {
	readonly capture: Capture<unknown>;
	readonly entries: Effect.Success<ReturnType<typeof makeDiaryEntries>>;
	entry: DiaryEntry | undefined;
	readonly keys: ReturnType<typeof diaryKeys>;
	readonly reactivity: Reactivity.Reactivity;
	readonly tableName: string;
	readonly woken: string[];
}

function makeDiaryEntries(tableName: string) {
	return makeRepository(DiaryEntry, { collection: diaryKeys(tableName), idColumn: "id", spanPrefix: "DiaryEntries", tableName });
}

const tupleBucketsEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `diary_entries_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer generated always as identity primary key, "ownerId" text not null, day integer, note text not null)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const engine: TupleBucketsEngine = {
		capture: yield* makeCapture<unknown>(),
		entries: yield* makeDiaryEntries(tableName),
		entry: undefined,
		keys: diaryKeys(tableName),
		reactivity: yield* Reactivity.Reactivity,
		tableName,
		woken: [],
	};
	return engine;
});

function bucketWords(engine: TupleBucketsEngine, key: string) {
	const [kind, table, field, value]: unknown[] = JSON.parse(key.startsWith("[") ? key : "[]");
	if (kind !== "bucket" || table !== engine.tableName) {
		return [];
	}
	if (field === "ownerDay") {
		const [owner, day]: unknown[] = JSON.parse(String(value));
		return [`${String(owner)} ${dayWords(day === null ? null : Number(day))}`];
	}
	return [`owner ${String(value)}`];
}

export const tupleBuckets = storyKit({
	...onPostgres,
	create: tupleBucketsEngine,
	name: "PostgreSQL tuple buckets",
	stages: ["rows", "watchers"],
	verbs: (engine: TupleBucketsEngine, story) => {
		function written<A, E, R>(line: string, write: (entry: DiaryEntry) => Effect.Effect<A, E, R>) {
			return Effect.suspend(() => {
				story.tell(line);
				const { entry } = engine;
				if (entry === undefined) {
					return Effect.die(new Error("Give the story alice's entry first"));
				}
				return write(entry).pipe(Effect.provide(engine.capture.layer(ChangeObserver)), Effect.orDie, Effect.asVoid);
			});
		}
		return {
			deletesEntry: () => written("alice's entry is deleted", ({ id }) => engine.entries.delete(id)),
			editsEntry: () => written("alice's entry gets a new note on the same day", (entry) => engine.entries.update({ ...entry, note: "edited" })),
			inserts: (owner: string, day: Day) =>
				Effect.suspend(() => {
					story.tell(`${owner} writes an entry for ${dayWords(day)}`);
					return engine.entries
						.insert({ day, note: "new", ownerId: owner })
						.pipe(Effect.provide(engine.capture.layer(ChangeObserver)), Effect.orDie, Effect.asVoid);
				}),
			movesEntryTo: (day: Day) => written(`alice's entry moves to ${dayWords(day)}`, (entry) => engine.entries.update({ ...entry, day })),
			publishedBuckets: () =>
				Effect.map(engine.capture.attempted, (batches) =>
					[...new Set(batches.flat().flatMap((key) => bucketWords(engine, String(key))))].toSorted(Order.String),
				),
			woken: () => Effect.sync(() => engine.woken.toSorted(Order.String)),
		};
	},
});

export function aliceEntryOnDay(day: Day) {
	return tupleBuckets.trait("rows", `alice has an entry for ${dayWords(day)}`, function* (engine) {
		engine.entry = yield* engine.entries.insert({ day, note: "first", ownerId: "alice" });
	});
}

export function watches(owner: string, day: number) {
	return tupleBuckets.trait("watchers", `a query subscribes to ${owner}'s entries for day ${day}`, function* (engine) {
		const stop = engine.reactivity.registerUnsafe(readKeys([engine.keys.bucket.ownerDay({ day, ownerId: owner })]), () =>
			engine.woken.push(`${owner} day ${day}`),
		);
		yield* Effect.addFinalizer(() => Effect.sync(stop));
	});
}
