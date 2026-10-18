import { Exit } from "effect";
import { expect } from "vitest";
import { cleanup, crashedRun, leftoverDatabase, limitedCleanupRole } from "#test/cleanup.ts";

cleanup.it(
	"a test scope finishes while its drop is blocked, and run end drains the drop",
	[],
	function* ({ openClone, holdDrops, closeClone, waitForDrop, readCloneScopeExit, readDatabase, readName, releaseDrops, closeRun }) {
		yield* openClone();
		yield* holdDrops();
		yield* closeClone();
		yield* waitForDrop();
		expect(yield* readCloneScopeExit()).toEqual(Exit.void);
		expect(yield* readDatabase()).toEqual([{ datname: yield* readName() }]);
		yield* releaseDrops();
		yield* closeRun();
		expect(yield* readDatabase()).toEqual([]);
	},
);

cleanup.it(
	"an exhausted drop retries after capacity returns without leaking the clone",
	[limitedCleanupRole],
	function* ({
		openClone,
		exhaustBudget,
		closeClone,
		waitForFailedDrop,
		readCloneScopeExit,
		readDatabase,
		readName,
		restoreBudget,
		waitForDatabaseRemoval,
		closeRun,
	}) {
		yield* openClone();
		yield* exhaustBudget();
		yield* closeClone();
		expect((yield* waitForFailedDrop())[0]).toMatchObject([{ _tag: "Fail", error: { _tag: "SqlError", reason: { cause: { code: "53300" } } } }]);
		expect(yield* readCloneScopeExit()).toEqual(Exit.void);
		expect(yield* readDatabase()).toEqual([{ datname: yield* readName() }]);
		yield* restoreBudget();
		yield* waitForDatabaseRemoval();
		expect(yield* readDatabase()).toEqual([]);
		yield* closeRun();
	},
);

cleanup.it("starting a run sweeps a database left by an earlier crash", [leftoverDatabase], function* ({ readDatabase }) {
	expect(yield* readDatabase()).toEqual([]);
});

cleanup.it("starting a run sweeps every database owned by a crashed worker", [crashedRun], function* ({ readLeftoverNames, readLeftoverDatabases }) {
	expect(yield* readLeftoverNames()).toHaveLength(2);
	expect(yield* readLeftoverDatabases()).toEqual([]);
});

cleanup.it("another run leaves a live worker's clone available", [], function* ({ openClone, startAnotherRun, readDatabase, readName }) {
	yield* openClone();
	yield* startAnotherRun();
	expect(yield* readDatabase()).toEqual([{ datname: yield* readName() }]);
});

cleanup.it("queued drops can be drained before the owning layer closes", [], function* ({ openClone, closeClone, awaitCleanup, readDatabase }) {
	yield* openClone();
	yield* closeClone();
	yield* awaitCleanup();
	expect(yield* readDatabase()).toEqual([]);
});
