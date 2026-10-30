import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { databasesPrepared, fullAppToCompare, generatedWithOwnDatabases, realSetup } from "#test/traits.ts";

const REGISTRATIONS = ["src/modules.ts", "src/server/modules.ts", "src/server/workerModules.ts", "src/client/modules.ts"];
const NOTES_REFERENCE = /notes(?:Registration|Worker|Migrations)|notesModule|noteQueue|#modules\/notes/u;

application.it(
	"a minimal app has every file of the full app except those under src/modules/notes/",
	[fullAppToCompare],
	function* ({ createApp, filesMissingFrom, filesOnlyIn }) {
		yield* createApp("my-app", "--minimal", "--no-git");

		yield* outcomes({
			"only in the full app": [filesOnlyIn("full/my-app"), ["src/modules/notes/"]],
			"only in the minimal app": [filesMissingFrom("full/my-app"), []],
		});
	},
);

application.it(
	"a minimal app's files match the full app's, except its manifest, Quality baseline, record, secrets and module registrations",
	[fullAppToCompare],
	function* ({ createApp, filesDifferingFrom }) {
		yield* createApp("my-app", "--minimal", "--no-git");

		expect(yield* filesDifferingFrom("full/my-app")).toEqual([
			".create-app.json",
			".env.local",
			"package.json",
			"quality-baseline.jsonl",
			"src/client/modules.ts",
			"src/modules.ts",
			"src/server/modules.ts",
			"src/server/workerModules.ts",
		]);
	},
);

for (const registration of REGISTRATIONS) {
	application.it(
		`the full app's ${registration} registers notes, while a minimal app's registers nothing from it`,
		[fullAppToCompare],
		function* ({ createApp, file }) {
			expect(yield* file(registration)).toMatch(NOTES_REFERENCE);

			yield* createApp("my-app", "--minimal", "--no-git");

			expect(yield* file(registration)).not.toMatch(NOTES_REFERENCE);
		},
	);
}

application.it(
	"the full app depends on @tanstack/react-table for notes, while a minimal app does not",
	[fullAppToCompare],
	function* ({ createApp, dependsOn }) {
		expect(yield* dependsOn("@tanstack/react-table")).toBe(true);

		yield* createApp("my-app", "--minimal", "--no-git");

		expect(yield* dependsOn("@tanstack/react-table")).toBe(false);
	},
);

application.it("create-app --minimal records the app as minimal in .create-app.json", [], function* ({ createApp, generationRecord }) {
	yield* createApp("my-app", "--minimal", "--no-git");

	expect(yield* generationRecord()).toMatchObject({ minimal: true, name: "my-app" });
});

application.it(
	"a minimal app applies its registered migrations to its prepared database",
	[generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ migrate }) {
		expect(yield* migrate()).toBe("passed");
	},
);

application.it(
	"a minimal app passes its foundation admin stories",
	[generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ runFoundationAdminStories }) {
		expect(yield* runFoundationAdminStories()).toBe("passed");
	},
	120_000,
);

application.it(
	"a minimal app with prepared databases passes pnpm ready against workspace packages",
	[realSetup, generatedWithOwnDatabases("--minimal", "--no-git"), databasesPrepared],
	function* ({ ready }) {
		expect(yield* ready()).toBe("passed");
	},
	120_000,
);
