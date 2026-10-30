import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { updates } from "#test/updates.ts";
import { AS_RELEASED, appCommits, appEditsWithoutCommitting, createdWith010, published010, starterAt010, starterAt020 } from "#test/updateTraits.ts";

const APPLIED = "Applied create-app 0.2.0. Review the changes, run pnpm install and commit when ready.";
const shipsUpgrade = starterAt010("ships upgrade.txt reading original", { "upgrade.txt": "original\n" });
const changesUpgrade = starterAt020("rewrites upgrade.txt as starter content", { "upgrade.txt": "starter content\n" });

updates.it(
	"update applies the 0.2.0 starter's changed and added files to my-app",
	[
		shipsUpgrade,
		createdWith010(),
		published010,
		starterAt020("rewrites upgrade.txt and adds added.txt", { "added.txt": "new file\n", "upgrade.txt": "starter content\n" }),
	],
	function* ({ file, update }) {
		yield* outcomes({
			"added.txt": [file("added.txt"), "missing"],
			"upgrade.txt": [file("upgrade.txt"), "original\n"],
		});

		yield* update();

		yield* outcomes({
			"added.txt": [file("added.txt"), "new file\n"],
			"upgrade.txt": [file("upgrade.txt"), "starter content\n"],
		});
	},
);

updates.it(
	"update records 0.2.0 in .create-app.json and says it applied the release",
	[createdWith010(), published010, starterAt020("is unchanged")],
	function* ({ answer, generationRecord, update }) {
		expect(yield* generationRecord()).toEqual({ name: "my-app", version: "0.1.0" });

		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.2.0" }],
			answer: [answer(), APPLIED],
		});
	},
);

updates.it(
	"update leaves the applied release uncommitted for review",
	[shipsUpgrade, createdWith010(), published010, changesUpgrade],
	function* ({ commits, uncommittedChanges, update }) {
		expect(yield* uncommittedChanges()).toEqual([]);

		yield* update();

		yield* outcomes({
			commits: [commits(), ["Create App <create-app@localhost>: Initialize a generated app"]],
			"uncommitted changes": [uncommittedChanges(), [" M .create-app.json", "M  upgrade.txt"]],
		});
	},
);

updates.it(
	"update leaves an edit that overlaps the starter's as a listed Git conflict and keeps 0.1.0 recorded",
	[
		shipsUpgrade,
		createdWith010(),
		published010,
		appCommits("rewrites upgrade.txt as app content", { "upgrade.txt": "app content\n" }),
		changesUpgrade,
	],
	function* ({ answer, conflictedFiles, file, generationRecord, update }) {
		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.1.0" }],
			answer: [answer(), "create-app: Resolve these conflicts, then commit your changes:\nupgrade.txt\nThe recorded version remains 0.1.0."],
			"conflicted files": [conflictedFiles(), ["upgrade.txt"]],
			"upgrade.txt": [file("upgrade.txt"), "<<<<<<< ours\napp content\n=======\nstarter content\n>>>>>>> theirs\n"],
		});
	},
);

updates.it(
	"update keeps a file my-app deleted out of the release that changes it",
	[shipsUpgrade, createdWith010(), published010, appCommits("deletes upgrade.txt", { "upgrade.txt": null }), changesUpgrade],
	function* ({ answer, gitState, uncommittedChanges, update }) {
		yield* update();

		yield* outcomes({
			answer: [answer(), APPLIED],
			"uncommitted changes": [uncommittedChanges(), [" M .create-app.json"]],
			"upgrade.txt": [gitState("upgrade.txt"), "missing"],
		});
	},
);

updates.it(
	"update refuses a dirty working tree before fetching the recorded release, which is not published",
	[createdWith010(), appEditsWithoutCommitting("rewrites README.md as a draft", { "README.md": "app draft\n" }), starterAt020("is unchanged")],
	function* ({ answer, file, generationRecord, update }) {
		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.1.0" }],
			answer: [answer(), "create-app: Refusing to update a dirty working tree. Commit or stash your changes first."],
			"README.md": [file("README.md"), "app draft\n"],
		});
	},
);

updates.it(
	"update brings a minimal app the 0.2.0 foundation file but none of the notes example, and keeps it recorded as minimal",
	[
		createdWith010("--minimal"),
		published010,
		starterAt020("adds foundation.txt and src/modules/notes/new-example.ts", {
			"foundation.txt": "new foundation\n",
			"src/modules/notes/new-example.ts": "export const example = true;\n",
		}),
	],
	function* ({ dependsOn, exists, file, fileMentions, generationRecord, update }) {
		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { minimal: true, name: "my-app", version: "0.2.0" }],
			"depends on @tanstack/react-table": [dependsOn("@tanstack/react-table"), false],
			"foundation.txt": [file("foundation.txt"), "new foundation\n"],
			"src/modules/notes": [exists("src/modules/notes"), false],
			"src/server/modules.ts names notesRegistration": [fileMentions("src/server/modules.ts", "notesRegistration"), false],
		});
	},
);

updates.it(
	"update moves an app that listed @shivaedev/sql directly onto platform: it drops the dependency and hoists the pieces",
	[
		starterAt010("lists @shivaedev/sql directly and hoists nothing", {
			"package.json": (manifest) => manifest.replace('"dependencies": {', '"dependencies": {\n\t\t"@shivaedev/sql": "workspace:*",'),
			"pnpm-workspace.copy.yaml": (workspace) => workspace.replace(/\n#[^\n]*\npublicHoistPattern:[^\n]*\n/u, "\n"),
		}),
		createdWith010(),
		published010,
		starterAt020("depends on platform alone and hoists its pieces", { "package.json": AS_RELEASED, "pnpm-workspace.copy.yaml": AS_RELEASED }),
	],
	function* ({ dependsOn, fileMentions, update }) {
		yield* outcomes({
			"depends on @shivaedev/sql": [dependsOn("@shivaedev/sql"), true],
			"pnpm-workspace.yaml hoists": [fileMentions("pnpm-workspace.yaml", "publicHoistPattern"), false],
		});

		yield* update();

		yield* outcomes({
			"depends on @shivaedev/sql": [dependsOn("@shivaedev/sql"), false],
			"pnpm-workspace.yaml hoists": [fileMentions("pnpm-workspace.yaml", "publicHoistPattern"), true],
		});
	},
);
