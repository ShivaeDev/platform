import { Effect, Exit } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { makeTestStore, record, storageDatabaseUrl, withStorage } from "#test/storage.ts";

const integration = it.live.skipIf(storageDatabaseUrl === undefined);

integration("persists submission intent and exact accepted receipts across restart without releasing ownership", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			const prepared = yield* store.insert(record("board-a", "src/a"));
			const submitting = yield* store.compareAndSet(
				"board-a",
				prepared.version,
				{ ...prepared.value, operationId: "operation-a", stage: "submitting" },
				{ maxExecuting: 1 },
			);
			const restarted = yield* makeTestStore(namespace);
			yield* restarted.initialize();
			expect(yield* restarted.load("board-a")).toEqual(submitting);
			const overlap = yield* restarted.insert(record("board-b", "src/a/module.ts")).pipe(Effect.exit);
			expect(Exit.isFailure(overlap)).toBe(true);
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

integration("serializes competing admissions and rejects stale writes without losing another decision", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const results = yield* Effect.all(
				[store.insert(record("board-a", "src/shared")).pipe(Effect.exit), store.insert(record("board-b", "src/shared/module.ts")).pipe(Effect.exit)],
				{ concurrency: 2 },
			);
			expect(results.filter(Exit.isSuccess)).toHaveLength(1);
			expect(results.filter(Exit.isFailure)).toHaveLength(1);
			const [current] = yield* store.list();
			if (current === undefined) {
				return yield* Effect.die("expected admitted record");
			}
			const updated = yield* store.compareAndSet(current.value.workId, current.version, { ...current.value, stage: "terminal" });
			expect(
				Exit.isFailure(yield* store.compareAndSet(current.value.workId, current.version, { ...current.value, stage: "completed" }).pipe(Effect.exit)),
			).toBe(true);
			expect(yield* store.load(current.value.workId)).toEqual(updated);
		}),
	),
);

integration("retains overlapping foreign PR reservations and counts each backlog separately", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* store.reserveForeign("pr-one", ["src/shared"], { backlog: true, executing: false });
			yield* store.reserveForeign("pr-two", ["src/shared"], { backlog: true, executing: false });
			expect(yield* store.foreignReservations()).toHaveLength(2);
			expect(Exit.isFailure(yield* store.insert(record("board-a", "src/shared/module.ts")).pipe(Effect.exit))).toBe(true);
			yield* store.insert(record("board-b", "src/disjoint"));
			expect(Exit.isFailure(yield* store.insert({ ...record("board-c", "src/other"), stage: "terminal" }, { maxBacklog: 2 }).pipe(Effect.exit))).toBe(
				true,
			);
			yield* store.releaseForeign("pr-one");
			expect(Exit.isFailure(yield* store.insert(record("board-a", "src/shared")).pipe(Effect.exit))).toBe(true);
			yield* store.releaseForeign("pr-two");
			yield* store.insert(record("board-a", "src/shared"));
		}),
	),
);

integration("allows observing owned work after a foreign overlap appears and Schema rejects corrupted durable records", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			const first = yield* store.insert({ ...record("board-a", "src/shared"), stage: "submitting" });
			yield* store.reserveForeign("pr-one", ["src/shared"]);
			yield* store.compareAndSet("board-a", first.version, { ...first.value, sessionId: "session-a", stage: "running", turnId: "turn-a" });
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update ${sql(`${namespace}_records`)} set payload = '{"workId":"board-a","stage":"unknown"}'::jsonb where work_id = 'board-a'`;
			expect(Exit.isFailure(yield* store.load("board-a").pipe(Effect.exit))).toBe(true);
		}),
	),
);

integration("supports root ownership as overlap with all paths and rejects noncanonical Windows paths", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const root = yield* store.insert(record("board-root", "."));
			expect(Exit.isFailure(yield* store.insert(record("board-child", "src/a")).pipe(Effect.exit))).toBe(true);
			yield* store.compareAndSet("board-root", root.version, { ...root.value, stage: "completed" });
			yield* store.insert(record("board-child", "src/a"));
			expect(Exit.isFailure(yield* store.insert(record("board-next-root", ".")).pipe(Effect.exit))).toBe(true);
			for (const invalid of ["src\\module.ts", "/src", "src/../other", "src//other"]) {
				expect(Exit.isFailure(yield* store.insert(record("board-invalid", invalid)).pipe(Effect.exit))).toBe(true);
			}
		}),
	),
);
