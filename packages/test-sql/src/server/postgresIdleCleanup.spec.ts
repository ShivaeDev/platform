import { expect } from "vitest";
import { database } from "#test/database.ts";
import { markedSessions } from "#test/databaseTraits.ts";

database.it(
	"once the worker has opened a clone, no administration session stays open",
	[markedSessions],
	function* ({ adminSessions, openIsolatedBlock }) {
		yield* openIsolatedBlock("the isolated block");

		expect(yield* adminSessions()).toBe("none open");
	},
);
