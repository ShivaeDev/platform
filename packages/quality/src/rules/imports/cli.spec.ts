import { withMatchers } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { config } from "@shivaedev/test-kits/quality/adapters/tree.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { runtimeFolders } from "#test/runtimeFolders.ts";

const REASON = "The play screen previews CMS drafts until the preview service lands.";

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

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "invalid"],
				["problem", () => stderr(), expect.stringContaining("the import graph covers no modules")],
				["repair", () => stderr(), expect.stringContaining("Point `sources` at the TypeScript or JavaScript code.")],
				["turning the rules off", () => stderr(), expect.not.stringContaining("turn the imports rules off")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint rejects production imports of tests by default, at each import, and asks for shared production code",
	[repositoryHas(...PRODUCTION_IMPORTS_TESTS)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				[
					"repair",
					() => stdout(),
					expect.stringContaining("Move the shared code into a production module and import it from both production and tests."),
				],
				["test file import", () => stdout(), expect.stringContaining('src/app.ts:1  Imports test code through "./app.test.ts".')],
				["test support import", () => stdout(), expect.stringContaining('src/app.ts:2  Imports test code through "./test-support/fixture.ts".')],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint refuses a config exception for imports/no-test-code, which takes no exceptions",
	[
		repositoryHas(
			...PRODUCTION_IMPORTS_TESTS,
			config(
				`{ exceptions: [{ files: ["src/app.ts"], reason: ${JSON.stringify(REASON)}, rules: ["imports/no-test-code"], subject: "./app.test.ts" }], sources: ["src"] }`,
			),
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["refused exception", () => stdout(), expect.stringContaining("names a rule that takes no exceptions")],
			]),
		);
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

		yield* withMatchers((expect) =>
			outcomes([
				["browser global", () => stdout(), expect.stringContaining('Shared code uses browser global "window"')],
				["exit", () => outcome(), "rejected"],
				["node built-in", () => stdout(), expect.stringContaining("Shared code imports Node built-in")],
				["runtime findings", () => stdout(), expect.stringContaining("error imports/runtime (2)")],
			]),
		);
	},
	CLI_TIMEOUT,
);
