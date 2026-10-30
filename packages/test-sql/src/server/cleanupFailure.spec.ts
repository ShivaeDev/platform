import { expect } from "vitest";
import { cleanup, cloneClosed, cloneOpen, dropDenied, limitedCleanupRole, runStarted } from "#test/cleanup.ts";

cleanup.it(
	"closing the run dies with the SQL error of a queued drop the run's role may not perform",
	[limitedCleanupRole, runStarted, cloneOpen, dropDenied, cloneClosed],
	function* ({ closeRun, runClosing }) {
		yield* closeRun();

		expect(yield* runClosing()).toMatch(/^died with SQLSTATE 42501: /u);
	},
);
