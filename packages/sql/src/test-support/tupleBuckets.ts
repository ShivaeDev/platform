import { Effect, Order } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Capture, makeCapture } from "@shivaedev/changes/capture.ts";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { ReadRecorder } from "@shivaedev/changes/readRecorder.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { RepositoryListFilter } from "#repositoryFilter.ts";
import { type DiaryEntry, diaryEntries } from "#test/diaryEntries.ts";
import { onPostgres } from "#test/engines.ts";
import { ChangeObserver } from "#transact.ts";

type Day = number | null;

function dayWords(day: Day) {
	return day === null ? "no day" : `day ${day}`;
}

interface TupleBucketsEngine {
	readonly capture: Capture<unknown>;
	readonly entries: Effect.Success<typeof diaryEntries>["entries"];
	entry: DiaryEntry | undefined;
	readonly keys: Effect.Success<typeof diaryEntries>["keys"];
	readonly reactivity: Reactivity.Reactivity;
	readonly tableName: string;
	readonly woken: string[];
}

const tupleBucketsEngine = Effect.fnUntraced(function* () {
	const { entries, keys, tableName } = yield* diaryEntries;
	const engine: TupleBucketsEngine = {
		capture: yield* makeCapture<unknown>(),
		entries,
		entry: undefined,
		keys,
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

export function watches(owner: string, day: number | string) {
	return tupleBuckets.trait("watchers", `a query subscribes to ${owner}'s entries for day ${JSON.stringify(day)}`, function* (engine) {
		const stop = engine.reactivity.registerUnsafe(readKeys([engine.keys.bucket.ownerDay({ day, ownerId: owner })]), () =>
			engine.woken.push(`${owner} day ${day}`),
		);
		yield* Effect.addFinalizer(() => Effect.sync(stop));
	});
}

export function readsLatestPerDay(label: string, where: RepositoryListFilter<typeof DiaryEntry>) {
	return tupleBuckets.trait(
		"watchers",
		`a live query reads ${label} with latestPerGroup partitioned by owner and day, and listens on the keys that read records`,
		function* (engine) {
			const stops: (() => void)[] = [];
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					for (const stop of stops) {
						stop();
					}
				}),
			);
			yield* engine.entries.latestPerGroup({ limit: 1, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["ownerId", "day"], where }).pipe(
				Effect.provideService(ReadRecorder, (keys) =>
					Effect.sync(() => stops.push(engine.reactivity.registerUnsafe(readKeys(keys), () => engine.woken.push(label)))),
				),
				Effect.orDie,
			);
		},
	);
}
