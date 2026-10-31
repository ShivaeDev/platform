import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importFenceRepository, registry } from "#test/importFenceRepository.ts";
import { installedWorkspace } from "#test/installedWorkspace.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { runtimeFolders } from "#test/runtimeFolders.ts";
import { config } from "#test/tree.ts";

const REASON = "The play screen previews CMS drafts until the preview service lands.";

const PLAY_EXCEPTION = { file: "packages/game/src/play.ts", reason: REASON, rule: "imports/fences", subject: "game-keeps-out-of-cms" };

const FENCED = [qualityInstalled(), repositoryHas(...importFenceRepository), installedWorkspace("@demo/cms", "packages/cms"), biomeFormatted()];

const PRODUCTION_IMPORTS_TESTS = [
	config('{ sources: ["src"] }'),
	{ content: 'import "./app.test.ts";\nimport "./test-support/fixture.ts";', path: "src/app.ts" },
	{ content: 'import "./test-support/fixture.ts";', path: "src/app.test.ts" },
	{ content: "export const fixture = 1;", path: "src/test-support/fixture.ts" },
];

repositoryStory.it(
	"quality lint is invalid when the import graph covers no modules, and asks to point sources at the code instead of turning the imports rules off",
	[repositoryHas(...fixtureTree("empty").files, config('{ sources: ["docs"] }'))],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "invalid"],
			"problem": [stderr(), expect.stringContaining("the import graph covers no modules")],
			"repair": [stderr(), expect.stringContaining("Point `sources` at the TypeScript or JavaScript code.")],
			"turning the rules off": [stderr(), expect.not.stringContaining("turn the imports rules off")],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint rejects production imports of tests by default, at each import, and asks for shared production code",
	[repositoryHas(...PRODUCTION_IMPORTS_TESTS)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"repair": [stdout(), expect.stringContaining("Move the shared code into a production module and import it from both production and tests.")],
			"test file import": [stdout(), expect.stringContaining('src/app.ts:1  Imports test code through "./app.test.ts".')],
			"test support import": [stdout(), expect.stringContaining('src/app.ts:2  Imports test code through "./test-support/fixture.ts".')],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it("quality lint passes once a registry exception covers the one import across a fence", FENCED, function* ({ runs, writes }) {
	expect((yield* runs("lint")).stdout).toContain(
		'packages/game/src/play.ts:1  Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms"',
	);

	yield* writes(registry(PLAY_EXCEPTION));

	expect((yield* runs("lint")).outcome).toBe("passed");
});

repositoryStory.it(
	"quality lint refuses a registry exception for imports/no-test-code, which takes no exceptions",
	[
		repositoryHas(
			...PRODUCTION_IMPORTS_TESTS,
			registry({ file: "src/app.ts", reason: REASON, rule: "imports/no-test-code", subject: "./app.test.ts" }),
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"refused exception": [stdout(), expect.stringContaining("names a rule that takes no exceptions")],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint reports shared code that imports a Node built-in or reads a browser global without any runtime configuration",
	[
		qualityInstalled(),
		repositoryHas(config('{ sources: ["src/values.ts"] }'), {
			content: 'import "node:fs";\nexport const values = window.location;',
			path: "src/values.ts",
		}),
		runtimeFolders("src/server"),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"browser global": [stdout(), expect.stringContaining('Shared code uses browser global "window"')],
			"exit": [outcome(), "rejected"],
			"node built-in": [stdout(), expect.stringContaining("Shared code imports Node built-in")],
			"runtime findings": [stdout(), expect.stringContaining("error imports/runtime (2)")],
		});
	},
	CLI_TIMEOUT,
);
