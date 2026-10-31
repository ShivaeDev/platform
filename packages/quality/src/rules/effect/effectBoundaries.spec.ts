import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { qualityInstalled, repositoryHas as repositoryContains, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CONSTRUCTS = [
	{ code: "export async function run() {\n\treturn 1;\n}", found: [[1, "async function"]], name: "an async function" },
	{ code: "export const run = async () => 1;", found: [[1, "async arrow"]], name: "an async arrow" },
	{ code: "export class Runner {\n\tasync run() {\n\t\treturn 1;\n\t}\n}", found: [[2, "async method"]], name: "an async method" },
	{
		code: "export async function run(work: Promise<number>) {\n\treturn await work;\n}",
		found: [
			[1, "async function"],
			[2, "await"],
		],
		name: "an await and the async function around it",
	},
	{
		code: "export async function iteration(source: AsyncIterable<unknown>) {\n\tfor await (const value of source) String(value);\n}",
		found: [
			[1, "async function"],
			[2, "await"],
		],
		name: "a for await loop and the async function around it",
	},
	{
		code: "export async function disposal(resource: AsyncDisposable) {\n\tawait using current = resource;\n\treturn current;\n}",
		found: [
			[1, "async function"],
			[2, "await"],
		],
		name: "an await using declaration and the async function around it",
	},
	{ code: "export const pending = new Promise((resolve) => resolve(1));", found: [[1, "new Promise(...)"]], name: "a new Promise" },
	{ code: "export const text = Promise.resolve(1).then(String);", found: [[1, ".then(...)"]], name: "a .then call" },
	{ code: 'export const text = Promise.resolve(1)["then"](String);', found: [[1, ".then(...)"]], name: "a .then call by its string key" },
	{
		code: "export function read() {\n\ttry {\n\t\treturn 1;\n\t} finally {\n\t\tString(2);\n\t}\n}",
		found: [[2, "try statement"]],
		name: "a try statement",
	},
	{ code: 'export function fail() {\n\tthrow new Error("bad");\n}', found: [[2, "throw statement"]], name: "a throw statement" },
] as const;

const BRIDGE = "export async function bridge() {\n\treturn 1;\n}";

for (const { code, found, name } of CONSTRUCTS) {
	ruleStory.it(`effect/boundary reports ${name} at its line`, [repositoryHas({ content: code, path: "src/bridge.ts" })], function* ({ check }) {
		const findings = yield* check(effectBoundary);

		expect(findings).toEqual(found.map(([line, construct]) => usesAt("src/bridge.ts", line, construct)));
	});
}

ruleStory.it(
	"effect/boundary checks a spec like any other source",
	[repositoryHas({ content: BRIDGE, path: "src/bridge.spec.ts" })],
	function* ({ check }) {
		expect(yield* check(effectBoundary)).toEqual([usesAt("src/bridge.spec.ts", 1, "async function")]);
	},
);

for (const path of [
	"src/adapters/bridge.ts",
	"src/nested/adapters/bridge.ts",
	"src/test-support/bridge.ts",
	"tooling/nested/test-support/bridge.ts",
]) {
	ruleStory.it(`effect/boundary exempts ${path}`, [repositoryHas({ content: BRIDGE, path })], function* ({ check }) {
		expect(yield* check(effectBoundary)).toEqual([]);
	});
}

for (const rule of ["effect/boundary", "effect/service-parameters"]) {
	repositoryStory.it(
		`quality lint refuses a config exception for ${rule}, which takes no exceptions`,
		[
			qualityInstalled(),
			repositoryContains(
				{ content: "export const value = 1;\n", path: "src/value.ts" },
				{
					content: `export default { exceptions: [{ files: ["src/value.ts"], reason: "An old bridge.", rules: ["${rule}"] }] };\n`,
					path: "quality.config.ts",
				},
			),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* outcomes({
				"exit": [outcome(), "rejected"],
				"report": [stdout(), expect.stringContaining(`${rule} src/value.ts names a rule that takes no exceptions`)],
			});
		},
	);
}

repositoryStory.it(
	"quality lint still reports the effect/boundary finding that a refused config exception names",
	[
		qualityInstalled(),
		repositoryContains(
			{ content: "export const BRIDGE = async () => 1;\n", path: "src/bridge.ts" },
			{
				content: 'export default { exceptions: [{ files: ["src/bridge.ts"], reason: "An old bridge.", rules: ["effect/boundary"] }] };\n',
				path: "quality.config.ts",
			},
		),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		expect(yield* stdout()).toContain("src/bridge.ts:1  Uses async arrow.");
	},
);

repositoryStory.it(
	"quality lint keeps the ambient time, randomness, console and process.env bans inside an adapters/ folder",
	[
		qualityInstalled(),
		repositoryContains({
			content: 'export function ambient() {\n\tconsole.log(Date.now(), Math.random(), process.env["MODE"]);\n}\n',
			path: "src/adapters/ambient.ts",
		}),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"console": [stdout(), expect.stringContaining("console.* is banned")],
			"process.env": [stdout(), expect.stringContaining("process.env is banned")],
			"randomness": [stdout(), expect.stringContaining("Ambient randomness is banned")],
			"time": [stdout(), expect.stringContaining("Ambient time is banned")],
		});
	},
);
