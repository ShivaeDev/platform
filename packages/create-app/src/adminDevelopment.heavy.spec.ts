import { expect } from "vitest";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases } from "#test/traits.ts";

application.it(
	"a generated app serves assets with shared cache and security headers and enforces admin permissions",
	[generatedWithOwnDatabases("--no-git"), databasesPrepared],
	function* ({ runAdminStories }) {
		expect(yield* runAdminStories()).toBe("passed");
	},
	120_000,
);
