import { expect } from "vitest";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases } from "#test/traits.ts";

application.it(
	"a minimal app applies its registered migrations to its prepared database",
	[generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ migrate }) {
		expect(yield* migrate()).toBe("passed");
	},
);
