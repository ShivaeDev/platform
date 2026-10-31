import { expect } from "vitest";
import { builtInRules } from "#rules/builtIn.ts";
import { configFile, configLoading } from "#test/configLoading.ts";

const TODO_RULE =
	'import { defineRule } from "@shivaedev/quality/rule.ts";\nconst todo = defineRule({ check: () => [], description: "Resolve TODOs.", id: "local/no-todo" });\n';

const BUILT_IN = builtInRules.map((rule) => rule.id);

configLoading.it(
	"a config with a local rule activates every built-in rule and the local rule",
	[configFile(`${TODO_RULE}export default { local: [todo] };\n`)],
	function* ({ activeRules, loads }) {
		yield* loads();

		expect(yield* activeRules()).toEqual([...BUILT_IN, "local/no-todo"]);
	},
);

configLoading.it(
	"rules set to error explicitly, alone or with options, stay active",
	[
		configFile(
			`${TODO_RULE}export default { local: [todo], rules: { "local/no-todo": "error", "structure/max-lines": { level: "error", options: { source: 100 } } } };\n`,
		),
	],
	function* ({ activeRules, loads }) {
		yield* loads();

		expect(yield* activeRules()).toEqual([...BUILT_IN, "local/no-todo"]);
	},
);

for (const level of ["warn", "off"]) {
	for (const [form, setting] of [
		["alone", `"${level}"`],
		["with options", `{ level: "${level}", options: { source: 100 } }`],
	]) {
		configLoading.it(
			`quality refuses structure/max-lines set to ${level} ${form} and names the rule`,
			[configFile(`export default { rules: { "structure/max-lines": ${setting} } };\n`)],
			function* ({ issues, loads }) {
				yield* loads();

				expect(yield* issues()).toEqual([expect.stringMatching(/^rules\.structure\/max-lines/u)]);
			},
		);
	}
}

configLoading.it(
	"quality refuses an unknown setting and names it",
	[configFile('export default { source: ["src"] };\n')],
	function* ({ issues, loads }) {
		yield* loads();

		expect(yield* issues()).toEqual([expect.stringMatching(/^source: /u)]);
	},
);

configLoading.it(
	"quality refuses invalid options and names the rule and the option",
	[configFile('export default { rules: { "structure/max-lines": { options: { source: "many" } } } };\n')],
	function* ({ issues, loads }) {
		yield* loads();

		expect(yield* issues()).toEqual([expect.stringMatching(/^rules\.structure\/max-lines\.options: source: /u)]);
	},
);

configLoading.it(
	"quality refuses a local rule not made with defineRule",
	[configFile('export default { local: [{ check: () => [], id: "local/x" }] };\n')],
	function* ({ issues, loads }) {
		yield* loads();

		expect(yield* issues()).toEqual([expect.stringContaining("a rule made with defineRule")]);
	},
);

configLoading.it(
	"quality refuses local rules that repeat a local id or take a built-in id, naming each id",
	[
		configFile(
			`${TODO_RULE}const copy = defineRule({ check: () => [], description: "Shadows the built-in rule.", id: "structure/max-lines" });\nexport default { local: [todo, todo, copy] };\n`,
		),
	],
	function* ({ issues, loads }) {
		yield* loads();

		expect(yield* issues()).toEqual(['local: rule id "local/no-todo" is already defined', 'local: rule id "structure/max-lines" is already defined']);
	},
);

configLoading.it(
	"quality reports a local rule whose options schema throws as an invalid option instead of crashing",
	[
		configFile(
			'import { defineRule } from "@shivaedev/quality/rule.ts";\nconst throwing = defineRule({ check: () => [], description: "Its schema throws.", id: "local/throwing", options: { "~standard": { validate: () => { throw new Error("schema exploded"); }, vendor: "test", version: 1 } } });\nexport default { local: [throwing] };\n',
		),
	],
	function* ({ issues, loads }) {
		yield* loads();

		expect(yield* issues()).toEqual(["rules.local/throwing.options: validation threw: schema exploded"]);
	},
);
