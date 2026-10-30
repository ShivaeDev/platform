import { expect } from "vitest";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases } from "#test/traits.ts";

application.it(
	"a generated app passes its own admin stories, which serve the admin routes and enforce its declared permissions",
	[generatedWithOwnDatabases("--no-git"), databasesPrepared],
	function* ({ runAdminStories }) {
		expect(yield* runAdminStories()).toBe("passed");
	},
);
