import { expect } from "vitest";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases } from "#test/traits.ts";

application.it(
	"a minimal app serves assets with shared cache and security headers and passes its foundation admin stories",
	[generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ runFoundationAdminStories }) {
		expect(yield* runFoundationAdminStories()).toBe("passed");
	},
	120_000,
);
