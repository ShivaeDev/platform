import { expect } from "vitest";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases, realSetup } from "#test/traits.ts";

application.it(
	"a minimal app with prepared databases passes pnpm ready against workspace packages",
	[realSetup, generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ ready }) {
		expect(yield* ready()).toBe("passed");
	},
	120_000,
);
