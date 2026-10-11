import { Effect, Exit } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { makeTestStore, record, storageDatabaseUrl, withStorage } from "#test/storage.ts";

const integration = it.live.skipIf(storageDatabaseUrl === undefined);

integration("persists submission intent and exact accepted receipts across restart without releasing ownership", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			const prepared = yield* store.insert(record("board-a"));
			const submitting = yield* store.compareAndSet(
				"board-a",
				prepared.version,
				{ ...prepared.value, operationId: "operation-a", stage: "submitting" },
				{ maxExecuting: 1 },
			);
			const restarted = yield* makeTestStore(namespace);
			yield* restarted.initialize();
			expect(yield* restarted.load("board-a")).toEqual(submitting);
			const accepted = yield* restarted.compareAndSet(
				"board-a",
				submitting.version,
				{ ...submitting.value, sessionId: "session-a", stage: "running", turnId: "turn-a" },
				{ maxExecuting: 1 },
			);
			expect((yield* store.load("board-a"))?.value).toEqual(accepted.value);
		}),
	),
);

integration("serializes competing writes and rejects the stale one without losing the other decision", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const prepared = yield* store.insert(record("board-a"));
			const results = yield* Effect.all(
				(["terminal", "completed"] as const).map((stage) =>
					store.compareAndSet("board-a", prepared.version, { ...prepared.value, stage }).pipe(Effect.exit),
				),
				{ concurrency: 2 },
			);
			expect(results.filter(Exit.isSuccess)).toHaveLength(1);
			expect(results.filter(Exit.isFailure)).toHaveLength(1);
			const winner = results.find(Exit.isSuccess);
			expect(yield* store.load("board-a")).toEqual(winner?.value);
		}),
	),
);

integration("counts each foreign PR backlog separately until released", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* store.reserveForeign("pr-one", { backlog: true, executing: false });
			yield* store.reserveForeign("pr-two", { backlog: true, executing: false });
			expect(yield* store.foreignReservations()).toHaveLength(2);
			expect(Exit.isFailure(yield* store.insert({ ...record("board-a"), stage: "terminal" }, { maxBacklog: 2 }).pipe(Effect.exit))).toBe(true);
			yield* store.releaseForeign("pr-one");
			yield* store.insert({ ...record("board-a"), stage: "terminal" }, { maxBacklog: 2 });
		}),
	),
);

integration("Schema rejects corrupted durable records", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			yield* store.insert({ ...record("board-a"), stage: "submitting" });
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update ${sql(`${namespace}_records`)} set payload = '{"workId":"board-a","stage":"unknown"}'::jsonb where work_id = 'board-a'`;
			expect(Exit.isFailure(yield* store.load("board-a").pipe(Effect.exit))).toBe(true);
		}),
	),
);
