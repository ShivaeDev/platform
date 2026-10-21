import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { competingStorage } from "#test/competingStorage.ts";
import { record } from "#test/storage.ts";
import { isolatedStorage, storage } from "#test/storageStory.ts";

const integration = storage;
const isolated = isolatedStorage;

integration.it(
	"persists submission intent and exact accepted receipts across restart without releasing ownership",
	[],
	function* ({ store, namespace, migrate, openStore }) {
		const prepared = yield* store.insert(record("board-a"));
		const submitting = yield* store.compareAndSet(
			"board-a",
			prepared.version,
			{ ...prepared.value, operationId: "operation-a", step: "submitting" },
			{ maxExecuting: 1 },
		);
		const restarted = yield* openStore(namespace);
		yield* migrate(namespace);
		expect(yield* restarted.load("board-a")).toEqual(submitting);
		const accepted = yield* restarted.compareAndSet(
			"board-a",
			submitting.version,
			{ ...submitting.value, sessionId: "session-a", step: "running", turnId: "turn-a" },
			{ maxExecuting: 1 },
		);
		expect((yield* store.load("board-a"))?.value).toEqual(accepted.value);
	},
);

isolated.it("serializes competing writes and rejects the stale one without losing the other decision", [], function* ({ store }) {
	const prepared = yield* store.insert(record("board-a"));
	const results = yield* Effect.all(
		(["terminal", "completed"] as const).map((step) =>
			store.compareAndSet("board-a", prepared.version, { ...prepared.value, step }).pipe(Effect.exit),
		),
		{ concurrency: 2 },
	);
	expect(results.filter(Exit.isSuccess)).toHaveLength(1);
	expect(results.filter(Exit.isFailure)).toHaveLength(1);
	const winner = results.find(Exit.isSuccess);
	expect(yield* store.load("board-a")).toEqual(winner?.value);
});

integration.it("counts each foreign PR backlog separately until released", [], function* ({ store }) {
	yield* store.reserveForeign("pr-one", { backlog: true, executing: false });
	yield* store.reserveForeign("pr-two", { backlog: true, executing: false });
	expect(yield* store.foreignReservations()).toHaveLength(2);
	expect(Exit.isFailure(yield* store.insert({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 }).pipe(Effect.exit))).toBe(true);
	yield* store.releaseForeign("pr-one");
	yield* store.insert({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 });
});

integration.it("Schema rejects corrupted durable records", [], function* ({ store, namespace, sql }) {
	yield* store.insert({ ...record("board-a"), step: "submitting" });

	yield* sql`update ${sql(`${namespace}_records`)} set step = 'unknown' where work_id = 'board-a'`;
	expect(Exit.isFailure(yield* store.load("board-a").pipe(Effect.exit))).toBe(true);
});

isolated.it("repository version predicate rejects a writer that races after Fleet's version check", [], function* ({ namespace }) {
	const store = yield* competingStorage(namespace);
	const original = yield* store.insert(record("board-a"));
	const conflict = yield* store.compareAndSet("board-a", original.version, { ...original.value, step: "completed" }).pipe(Effect.flip);
	expect(conflict).toMatchObject({ _tag: "StorageConflict", actualVersion: 2, expectedVersion: 1, workId: "board-a" });
	expect(yield* store.load("board-a")).toEqual({ value: { ...original.value, step: "running" }, version: 2 });
});
