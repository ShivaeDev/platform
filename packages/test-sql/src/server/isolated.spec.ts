import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";

database.it(
	"isolated databases clone prepared fixtures once, commit for real, and drop after use",
	[],
	function* ({
		inClone,
		writeSharedItem,
		readCurrentDatabaseName,
		readItems,
		openCloneClient,
		watchItemInvalidations,
		commitItem,
		readItemsFrom,
		readSharedItems,
		readPreparationCounts,
		closeWorker,
		readDatabases,
	}) {
		yield* writeSharedItem("shared");
		const names = yield* Effect.all(
			["a", "b"].map((value) =>
				inClone(
					Effect.gen(function* () {
						const name = yield* readCurrentDatabaseName();
						expect(yield* readItems()).toEqual([{ value: "seed" }]);
						const other = yield* openCloneClient();
						const readInvalidations = yield* watchItemInvalidations();
						yield* commitItem(value);
						expect(yield* readItemsFrom(other)).toEqual([{ value }]);
						expect(readInvalidations()).toEqual([1]);
						return name;
					}),
				),
			),
			{ concurrency: "unbounded" },
		);
		expect([...new Set(names)]).toEqual([expect.stringMatching(/^effect_test_/u), expect.stringMatching(/^effect_test_/u)]);
		expect(yield* readSharedItems()).toEqual([{ value: "shared" }]);
		expect(yield* readPreparationCounts()).toEqual({ fixtures: 1, migrations: 1 });
		yield* closeWorker();
		expect(yield* readDatabases(names)).toEqual([]);
	},
);

database.it(
	"isolated databases clean up after typed failure, defects and interruption",
	[],
	function* ({ inClone, readCurrentDatabaseName, writeItem, closeWorker, readDatabases }) {
		const names: string[] = [];
		const record = Effect.gen(function* () {
			names.push(yield* readCurrentDatabaseName());
			yield* writeItem("committed");
		});
		expect(yield* inClone(Effect.andThen(record, Effect.fail("rejected"))).pipe(Effect.flip)).toBe("rejected");
		const defect = yield* inClone(Effect.andThen(record, Effect.die("assertion"))).pipe(Effect.exit);
		expect(Exit.isFailure(defect) && Cause.hasDies(defect.cause)).toBe(true);
		const entered = yield* Deferred.make<void>();
		const fiber = yield* inClone(
			Effect.gen(function* () {
				yield* record;
				yield* Deferred.succeed(entered, undefined);
				yield* Effect.never;
			}),
		).pipe(Effect.forkScoped);
		yield* Deferred.await(entered);
		yield* Fiber.interrupt(fiber);
		const interrupted = yield* Fiber.await(fiber);
		expect(Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)).toBe(true);
		expect([...new Set(names)]).toEqual([
			expect.stringMatching(/^effect_test_/u),
			expect.stringMatching(/^effect_test_/u),
			expect.stringMatching(/^effect_test_/u),
		]);
		yield* closeWorker();
		expect(yield* readDatabases(names)).toEqual([]);
	},
);

database.it(
	"closing the worker scope drops both the template and shared database",
	[],
	function* ({ readWorkerDatabaseNames, readDatabases, closeWorker }) {
		const names = yield* readWorkerDatabaseNames();
		expect(names.every(Boolean)).toBe(true);
		expect((yield* readDatabases(names)).map(({ datname }) => datname).sort()).toEqual([...names].sort());
		yield* closeWorker();
		expect(yield* readDatabases(names)).toEqual([]);
	},
);
