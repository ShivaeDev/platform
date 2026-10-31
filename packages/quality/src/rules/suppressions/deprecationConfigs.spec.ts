import { expect } from "vitest";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MESSAGE =
	'Sets "ignoreDeprecations", which silences TypeScript\'s errors for deprecated options. Remove it and replace the deprecated option it hides.';

const IGNORING = '{\n\t"compilerOptions": {\n\t\t"strict": true,\n\t\t"ignoreDeprecations": "6.0"\n\t}\n}\n';

ruleStory.it(
	"suppressions/no-ignore-deprecations reports ignoreDeprecations at its line in every tsconfig the repository owns, whatever its name or folder, and skips ignored and installed ones",
	[
		repositoryHas(
			{ content: "ignored/\n", path: ".gitignore" },
			{ content: IGNORING, path: "tsconfig.json" },
			{ content: IGNORING, path: "packages/web/tsconfig.build.json" },
			{ content: `// shared\n${IGNORING.replace('"6.0"\n', '"6.0",\n')}`, path: "tsconfig/browser.json" },
			{ content: IGNORING, path: "ignored/tsconfig.json" },
			{ content: IGNORING, path: "node_modules/some-package/tsconfig.json" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(noIgnoreDeprecations);

		expect(findings).toEqual([
			{ file: "packages/web/tsconfig.build.json", line: 4, message: MESSAGE, subject: "ignoreDeprecations" },
			{ file: "tsconfig.json", line: 4, message: MESSAGE, subject: "ignoreDeprecations" },
			{ file: "tsconfig/browser.json", line: 5, message: MESSAGE, subject: "ignoreDeprecations" },
		]);
	},
);

ruleStory.it(
	"suppressions/no-ignore-deprecations accepts ignoreDeprecations outside compilerOptions",
	[repositoryHas({ content: '{ "compilerOptions": { "strict": true }, "ignoreDeprecations": "6.0" }\n', path: "tsconfig.json" })],
	function* ({ check }) {
		expect(yield* check(noIgnoreDeprecations)).toEqual([]);
	},
);
