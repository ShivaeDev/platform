import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { installedWorkspace } from "#test/installedWorkspace.ts";
import { manifestTree } from "#test/manifestTree.ts";
import { repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { config } from "#test/tree.ts";

const UNDECLARED = 'Imports workspace package "plain-kit" without declaring it in modules/app/package.json';

const APP = { content: 'import "plain-kit";\nexport const app = 1;', path: "modules/app/src/app.ts" };

const SELECTIONS = [
	{ linked: false, sources: ["modules/app/src", "modules/kit/src"], workspace: "npm" },
	{ linked: false, sources: ["modules/app/src", "modules/kit/src"], workspace: "pnpm" },
	{ linked: true, sources: ["modules/app/src"], workspace: "npm" },
	{ linked: true, sources: ["modules/app/src"], workspace: "pnpm" },
] as const;

repositoryStory.it(
	"quality lint reports an undeclared workspace import through imports/manifest without any import configuration or fence",
	[repositoryHas(...manifestTree().files, config('{ sources: ["modules"] }'), APP)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["manifest findings", () => stdout(), expect.stringContaining("error imports/manifest (1)")],
			["undeclared import", () => stdout(), expect.stringContaining(UNDECLARED)],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint checks one resolved import against both the manifest's dependencies and the test-code boundary",
	[
		repositoryHas(
			...manifestTree({ declaration: "devDependencies" }).files,
			config('{ sources: ["modules"] }'),
			{ content: 'import "plain-kit/test-support/fixture.ts";', path: "modules/app/src/app.ts" },
			{ content: 'import "plain-kit/test-support/fixture.ts";', path: "modules/app/src/app.test.ts" },
			{ content: "export const fixture = 1;", path: "modules/kit/src/test-support/fixture.ts" },
		),
		installedWorkspace("plain-kit", "modules/kit"),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["manifest findings", () => stdout(), expect.stringContaining("error imports/manifest (1)")],
			[
				"test-code finding",
				() => stdout(),
				expect.stringContaining('modules/app/src/app.ts:1  Imports test code through "plain-kit/test-support/fixture.ts".'),
			],
			["test-code findings", () => stdout(), expect.stringContaining("error imports/no-test-code (1)")],
		]);
	},
	CLI_TIMEOUT,
);

for (const { linked, sources, workspace } of SELECTIONS) {
	repositoryStory.it(
		`quality lint reads the ${workspace} workspace's manifests outside the selected sources ${sources.join(", ")}${linked ? " with plain-kit installed" : ""}`,
		[
			repositoryHas(...manifestTree({ workspace }).files, config(`{ sources: ${JSON.stringify(sources)} }`), APP),
			...(linked ? [installedWorkspace("plain-kit", "modules/kit")] : []),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["exit", () => outcome(), "rejected"],
				["undeclared import", () => stdout(), expect.stringContaining(UNDECLARED)],
			]);
		},
		CLI_TIMEOUT,
	);
}

repositoryStory.it(
	"quality lint keeps each importing member's own dependencies when only source folders are selected, ignoring the root's",
	[
		repositoryHas(
			...manifestTree({ declaration: "dependencies" }).files,
			config('{ sources: ["modules/app/src", "modules/kit/src"] }'),
			{ content: 'import "plain-kit";', path: "modules/app/src/app.ts" },
			{ content: 'import "@acme/app";', path: "modules/kit/src/app.ts" },
			{ content: '{"name":"root","dependencies":{"@acme/app":"workspace:*","plain-kit":"workspace:*"}}', path: "package.json" },
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["declared import", () => stdout(), expect.not.stringContaining('Imports workspace package "plain-kit" without declaring it')],
			["exit", () => outcome(), "rejected"],
			["manifest findings", () => stdout(), expect.stringContaining("error imports/manifest (1)")],
			[
				"undeclared import",
				() => stdout(),
				expect.stringContaining('Imports workspace package "@acme/app" without declaring it in modules/kit/package.json'),
			],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint keeps a member's devDependencies to its test code when the imported member is not selected",
	[
		repositoryHas(
			...manifestTree({ declaration: "devDependencies" }).files,
			config('{ sources: ["modules/app/src"] }'),
			{ content: 'import "plain-kit";', path: "modules/app/src/app.ts" },
			{ content: 'import "plain-kit";', path: "modules/app/src/app.test.ts" },
			{ content: '{"name":"root","dependencies":{"plain-kit":"workspace:*"}}', path: "package.json" },
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			[
				"development dependencies",
				() => stdout(),
				expect.stringContaining(
					"devDependencies are only available to tests, test support, tooling and export-blocked bundle inputs unreachable from runtime code.",
				),
			],
			["exit", () => outcome(), "rejected"],
			["manifest findings", () => stdout(), expect.stringContaining("error imports/manifest (1)")],
			["undeclared import", () => stdout(), expect.stringContaining(UNDECLARED)],
		]);
	},
	CLI_TIMEOUT,
);
