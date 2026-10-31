import { expect } from "vitest";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CONSTRUCTS = [
	{ code: "export async function run() {\n\treturn 1;\n}", found: [[1, "async function"]], name: "an async function" },
	{ code: "export const run = async () => 1;", found: [[1, "async arrow"]], name: "an async arrow" },
	{ code: "export class Runner {\n\tasync run() {\n\t\treturn 1;\n\t}\n}", found: [[2, "async method"]], name: "an async method" },
	{
		code: "export async function run(work: Promise<number>) {\n\treturn await work;\n}",
		found: [
			[1, "async function"],
			[1, "Promise-typed parameter (work)"],
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
	ruleStory.it(
		`effect/boundary reports ${name} at its line`,
		[repositoryHas({ content: code, path: "src/bridge.ts" })],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			expect(findings).toEqual(found.map(([line, construct]) => usesAt("src/bridge.ts", line, construct)));
		},
		CLI_TIMEOUT,
	);
}

ruleStory.it(
	"effect/boundary checks a spec like any other source",
	[repositoryHas({ content: BRIDGE, path: "src/bridge.spec.ts" })],
	function* ({ check }) {
		expect(yield* check(effectBoundary)).toEqual([usesAt("src/bridge.spec.ts", 1, "async function")]);
	},
	CLI_TIMEOUT,
);

for (const path of [
	"src/adapters/bridge.ts",
	"src/nested/adapters/bridge.ts",
	"src/test-support/bridge.ts",
	"tooling/nested/test-support/bridge.ts",
]) {
	ruleStory.it(
		`effect/boundary exempts ${path}`,
		[repositoryHas({ content: BRIDGE, path })],
		function* ({ check }) {
			expect(yield* check(effectBoundary)).toEqual([]);
		},
		CLI_TIMEOUT,
	);
}
