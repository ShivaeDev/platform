import { Effect, Fiber, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";
import type { Key } from "@shivaedev/changes/keys.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { onPostgres } from "#test/engines.ts";
import { groupPurgeEngine, rejectSecondGroup, seedGroups } from "#test/groupPurges.ts";
import { failureOf } from "#test/outcome.ts";

function hintName(key: Key) {
	if (key._tag === "Item") {
		return `item ${key.id}`;
	}
	if (key._tag === "Bucket") {
		return `${key.field} ${key.value}`;
	}
	return "collection";
}

const engine = Effect.fnUntraced(function* () {
	const rows = yield* groupPurgeEngine();
	const readers = new Map<string, { readonly delivered: Queue.Queue<readonly number[]>; readonly hints: string[][] }>();
	const live = yield* makeLiveServer;
	const subscribe = Effect.fnUntraced(function* <E, R>(name: string, keys: readonly Key[], read: Effect.Effect<readonly number[], E, R>) {
		const delivered = yield* Queue.unbounded<readonly number[]>();
		const hints: string[][] = [];
		yield* live.stream(keys).pipe(
			Stream.runForEach((hint) =>
				Effect.gen(function* () {
					if (hint._tag === "Changed") {
						hints.push(hint.keys.map(hintName));
					}
					yield* Queue.offer(delivered, yield* read);
				}),
			),
			Effect.forkScoped,
		);
		readers.set(name, { delivered, hints });
	});
	function ids<T extends { readonly id: number }>(records: readonly T[]) {
		return records.map(({ id }) => id);
	}
	const connect = Effect.gen(function* () {
		yield* subscribe(
			"alice",
			[rows.keys.bucket.owner("alice")],
			rows.runs.findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner: "alice" } }).pipe(Effect.map(ids)),
		);
		yield* subscribe(
			"childBucket",
			[rows.childKeys.bucket.owner("alice")],
			rows.children.findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner: "alice" } }).pipe(Effect.map(ids)),
		);
		yield* subscribe("item", [rows.keys.item(1)], rows.runs.findMany({ where: { id: 1 } }).pipe(Effect.map(ids)));
		yield* subscribe("childItem", [rows.childKeys.item(11)], rows.children.findMany({ where: { id: 11 } }).pipe(Effect.map(ids)));
		yield* subscribe(
			"bob",
			[rows.keys.bucket.owner("bob"), rows.childKeys.bucket.owner("bob")],
			rows.runs.findMany({ where: { owner: "bob" } }).pipe(Effect.map(ids)),
		);
	});
	function reader(name: string) {
		const current = readers.get(name);
		if (current === undefined) {
			throw new Error("Connect readers first");
		}
		return current;
	}
	const running: { fiber: Fiber.Fiber<number | string, unknown> | undefined } = { fiber: undefined };
	return { ...rows, connect, reader, running };
});

export const groupReaders = storyKit({
	...onPostgres,
	clock: "test",
	create: engine,
	name: "PostgreSQL grouped retention readers",
	stages: ["rows", "constraints", "readers"],
	verbs: (rows, story) => ({
		bobHints: () => Effect.sync(() => [...rows.reader("bob").hints]),
		finish: () => (rows.running.fiber === undefined ? Effect.die("Start retention first") : Fiber.join(rows.running.fiber)),
		nextAlice: () => Queue.take(rows.reader("alice").delivered),
		nextChildBucket: () => Queue.take(rows.reader("childBucket").delivered),
		nextChildItem: () => Queue.take(rows.reader("childItem").delivered),
		nextItem: () => Queue.take(rows.reader("item").delivered),
		passBatchPause: () => {
			story.tell("one second passes before the next retention batch");
			return Queue.take(rows.commits).pipe(Effect.andThen(TestClock.adjust("1 second")));
		},
		singleTablePurge: () => {
			story.tell("a single-table purge attempts to remove alice’s remaining runs while group retention is paused");
			return rows.runs.deleteBatched({ batchSize: 10, maxRows: 10, pause: 0, where: { owner: "alice" } });
		},
		start: (maxRows = 5) =>
			Effect.gen(function* () {
				story.tell("retention starts purging alice's groups in three-row batches");
				rows.running.fiber = yield* rows.purge({ batchSize: 3, maxRows, pause: "1 second" }).pipe(
					Effect.catchTag("SqlError", (error) => Effect.succeed(failureOf(error))),
					Effect.forkScoped,
				);
			}),
		storedGroups: rows.stored,
	}),
});

export function readerGroups() {
	return groupReaders.trait("rows", "alice's runs and children and bob's private run already exist", seedGroups);
}
export function refusedReaderGroup() {
	return groupReaders.trait("constraints", "the database refuses the second run's deletion", rejectSecondGroup);
}
export function readersReady() {
	return groupReaders.trait("readers", "item and owner-bucket readers have received their initial results", function* (rows) {
		yield* rows.connect;
		for (const name of ["alice", "childBucket", "item", "childItem", "bob"]) {
			yield* Queue.take(rows.reader(name).delivered);
		}
	});
}
