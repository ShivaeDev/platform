import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	cleanup,
	cloneClosed,
	cloneOpen,
	cloneOpenUnderPausedClock,
	crashedRun,
	dropRefusedForLackOfConnections,
	dropsBlocked,
	limitedCleanupRole,
	otherHostDatabase,
	runStarted,
	unownedLeftover,
} from "#test/cleanup.ts";

cleanup.it(
	"closing a clone's scope returns while its drop is blocked, and the clone's database still exists",
	[runStarted, cloneOpen, dropsBlocked],
	function* ({ closeClone, cloneDatabase }) {
		yield* closeClone();

		expect(yield* cloneDatabase()).toBe("exists");
	},
);

for (const { opened, clock } of [
	{ clock: "", opened: cloneOpen },
	{ clock: " while the story's test clock stays paused", opened: cloneOpenUnderPausedClock },
]) {
	cleanup.it(
		`a drop refused for lack of connections is retried and drops the clone once connections return${clock}`,
		[limitedCleanupRole, runStarted, opened, dropRefusedForLackOfConnections],
		function* ({ firstDropAttempt, cloneDatabase, connectionsReturn, cloneDatabaseOnceDrained }) {
			yield* outcomes({
				"the clone's database": [cloneDatabase(), "exists"],
				"the first drop attempt": [firstDropAttempt(), expect.stringMatching(/^failed with SQLSTATE 53300: /u)],
			});

			yield* connectionsReturn();

			expect(yield* cloneDatabaseOnceDrained()).toBe("dropped");
		},
	);
}

cleanup.it(
	"awaiting cleanup waits for the drop that closing a clone queued",
	[runStarted, cloneOpen, cloneClosed],
	function* ({ awaitCleanup, cloneDatabase }) {
		yield* awaitCleanup();

		expect(yield* cloneDatabase()).toBe("dropped");
	},
);

cleanup.it(
	"closing the run succeeds after the drop that closing a clone queued",
	[runStarted, cloneOpen, cloneClosed],
	function* ({ closeRun, runClosing, cloneDatabase }) {
		yield* closeRun();

		yield* outcomes({
			"closing the run": [runClosing(), "succeeded"],
			"the clone's database": [cloneDatabase(), "dropped"],
		});
	},
);

cleanup.it("starting a run drops a database an earlier run left in the unowned naming format", [unownedLeftover], function* ({ leftover, startRun }) {
	expect(yield* leftover()).toBe("exists");

	yield* startRun();

	expect(yield* leftover()).toBe("dropped");
});

cleanup.it(
	"starting a run drops every database of a worker on this host that exited",
	[crashedRun],
	function* ({ crashedWorkerDatabases, startRun }) {
		expect(yield* crashedWorkerDatabases()).toEqual(["its empty template", "its shared database"]);

		yield* startRun();

		expect(yield* crashedWorkerDatabases()).toEqual([]);
	},
);

cleanup.it("starting a run keeps a database owned by a worker on another host", [otherHostDatabase], function* ({ startRun, otherHostsDatabase }) {
	yield* startRun();

	expect(yield* otherHostsDatabase()).toBe("exists");
});

cleanup.it("starting another run keeps a live worker's clone", [runStarted, cloneOpen], function* ({ startAnotherRun, cloneDatabase }) {
	yield* startAnotherRun();

	expect(yield* cloneDatabase()).toBe("exists");
});
