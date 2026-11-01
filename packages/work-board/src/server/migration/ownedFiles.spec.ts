import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { linkedProject } from "#test/linkedProject.ts";
import { LEGACY_PLAN } from "#test/migrationOwnedFixture.ts";
import { referenceFile, workspaceLink } from "#test/servingStoryTraits.ts";

const MIGRATED = "---\nkind: goal\nstatus: ready\n---\n# Plan\n";
const excluded = ["node_modules/pkg/plan.md", "notes/node_modules/pkg/plan.md", ".drafts/plan.md", "notes/.drafts/plan.md", "plan.MD"];
const owned = ["plan.md", "notes/plan.md"];
const workspace = [projectFiles(Object.fromEntries([...owned, ...excluded].map((file) => [file, LEGACY_PLAN]))), deferredServing];

boardStory.it(
	"migration rewrites workspace Markdown and leaves scanner-excluded files unchanged",
	workspace,
	function* ({ migrationRuns, savedFiles }) {
		yield* migrationRuns();

		yield* outcomes([
			["workspace files", () => savedFiles(owned), Object.fromEntries(owned.map((file) => [file, MIGRATED]))],
			["excluded files", () => savedFiles(excluded), Object.fromEntries(excluded.map((file) => [file, LEGACY_PLAN]))],
		]);
	},
);

boardStory.it(
	"migration leaves outside reference files unchanged while rewriting workspace Markdown",
	[
		linkedProject,
		referenceFile("guide/start.md", LEGACY_PLAN),
		workspaceLink("reference-file.md", "reference/guide/start.md"),
		projectFiles({ "plan.md": LEGACY_PLAN }),
		deferredServing,
	],
	function* ({ migrationRuns, savedFile }) {
		yield* migrationRuns();

		yield* outcomes([
			["workspace file", () => savedFile("plan.md"), MIGRATED],
			["outside reference", () => savedFile("reference/guide/start.md"), LEGACY_PLAN],
			["outside file link", () => savedFile("reference-file.md"), LEGACY_PLAN],
		]);
	},
);

boardStory.it(
	"migration completes with an ancestor symlink and rewrites the workspace file once",
	[projectFiles({ "plan.md": LEGACY_PLAN }), workspaceLink("ancestor", "the parent folder"), deferredServing],
	function* ({ migrationReport, savedFile }) {
		const report = yield* migrationReport();

		yield* outcomes([
			["migration report", () => Effect.succeed(report), "Changed 1 files and 2 fields.\n"],
			["workspace file", () => savedFile("plan.md"), MIGRATED],
		]);
	},
);

boardStory.it("a second migration leaves workspace and excluded files unchanged", workspace, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain([...owned, ...excluded])).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});
