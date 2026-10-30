import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";

const MESSAGE =
	'Sets "ignoreDeprecations", which silences TypeScript\'s errors for deprecated options. Remove it and replace the deprecated option it hides.';

const IGNORING = '{\n\t"compilerOptions": {\n\t\t"strict": true,\n\t\t"ignoreDeprecations": "6.0"\n\t}\n}\n';

ruleKit.it(
	"reports ignoreDeprecations in every tsconfig the repository owns, whatever its name or folder",
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
	function* ({ checks }) {
		const findings = yield* checks(noIgnoreDeprecations);
		expect(findings.map((finding) => [finding.file, finding.line, finding.message, finding.subject])).toEqual([
			["packages/web/tsconfig.build.json", 4, MESSAGE, "ignoreDeprecations"],
			["tsconfig.json", 4, MESSAGE, "ignoreDeprecations"],
			["tsconfig/browser.json", 5, MESSAGE, "ignoreDeprecations"],
		]);
	},
);

ruleKit.it(
	"passes a tsconfig that names ignoreDeprecations anywhere but its compilerOptions",
	[
		repositoryHas(
			{ content: '{ "compilerOptions": { "strict": true }, "ignoreDeprecations": "6.0" }\n', path: "tsconfig.json" },
			{ content: '{ "description": "never set ignoreDeprecations" }\n', path: "notes.json" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(noIgnoreDeprecations)).toEqual([]);
	},
);
