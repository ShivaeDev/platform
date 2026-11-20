import { effectBoundary } from "#rules/effect/boundary.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { assertThat } from "#testing/assertThat.ts";

for (const marker of [
	'import * as NodeRuntime from "@effect/platform-node/NodeRuntime"; NodeRuntime.runMain(work);',
	"runMain(work);",
	'import { fileURLToPath } from "node:url"; if (fileURLToPath(import.meta.url) === process.argv[1]) { start(); }',
	"if (import.meta.main) { start(); }",
]) {
	ruleStory.it(
		`effect/boundary accepts a runner in an entry module using ${marker}`,
		[repositoryHas({ content: `import { Effect } from "effect";\n${marker}\nexport const result = Effect.runSync(work);`, path: "src/start.ts" })],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			yield* assertThat(findings, (actual) => actual.toEqual([]));
		},
		CLI_TIMEOUT,
	);
}

for (const marker of [
	'const example = "fileURLToPath(import.meta.url) === process.argv[1]";',
	"const library = { runMain() {} }; library.runMain(work);",
]) {
	ruleStory.it(
		`effect/boundary still reports a core runner beside ${marker}`,
		[repositoryHas({ content: `import { Effect } from "effect";\n${marker}\nexport const result = Effect.runSync(work);`, path: "src/work.ts" })],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			yield* assertThat(findings, (actual) => actual.toEqual([usesAt("src/work.ts", 3, "effect.Effect.runSync outside an entry point")]));
		},
		CLI_TIMEOUT,
	);
}

ruleStory.it(
	"effect/boundary follows a repository's imported Promise callback alias",
	[
		repositoryHas(
			{ content: "export type Load = () => PromiseLike<string>;", path: "src/load.ts" },
			{ content: 'import type { Load } from "./load.ts";\nexport const read = (load: Load) => load;', path: "src/read.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		yield* assertThat(findings, (actual) => actual.toEqual([usesAt("src/read.ts", 2, "Promise-typed parameter (load)")]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary still reports throws in a browser entry module",
	[repositoryHas({ content: 'import { Effect } from "effect";\nEffect.runSync(work);\nthrow new Error("missing");', path: "src/client/entry.tsx" })],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		yield* assertThat(findings, (actual) => actual.toEqual([usesAt("src/client/entry.tsx", 3, "throw statement")]));
	},
);

const RUNTIMES = [
	["ManagedRuntime.make(layer)", "effect.ManagedRuntime.make"],
	["Runtime.makeRunMain(start)", "effect.Runtime.makeRunMain"],
	...["FiberSet", "FiberMap", "FiberHandle"].flatMap((module) =>
		["makeRuntime", "makeRuntimePromise", "runtime", "runtimePromise"].map((name) => [`${module}.${name}()`, `effect.${module}.${name}`] as const),
	),
	["fiberRuntime()", "effect/FiberSet.makeRuntime"],
] as const;

const RUNTIME_MODULE = `import { FiberHandle, FiberMap, FiberSet, ManagedRuntime, Runtime } from "effect";
import { makeRuntime as fiberRuntime } from "effect/FiberSet";
export const runtimes = [
${RUNTIMES.map(([call]) => `\t${call},`).join("\n")}
];
`;

ruleStory.it(
	"effect/boundary reports each runtime constructor, imported or aliased, in core and accepts them under adapters/",
	[repositoryHas({ content: RUNTIME_MODULE, path: "src/runtimes.ts" }, { content: RUNTIME_MODULE, path: "src/adapters/runtimes.ts" })],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		yield* assertThat(findings, (actual) =>
			actual.toEqual(RUNTIMES.map(([, reference], index) => usesAt("src/runtimes.ts", index + 4, `${reference} outside an entry point`))),
		);
	},
	CLI_TIMEOUT,
);

for (const [form, helper, line] of [
	["an exported function", "export function start() {\n\tNodeRuntime.runMain(work);\n}", 5],
	["an exported curried runMain", "export const start = NodeRuntime.runMain({ disableErrorReporting: true });", 4],
	[
		"an exported function calling an imported runMain",
		'import { runMain } from "@effect/platform-node/NodeRuntime";\nexport const start = () => runMain(work);',
		5,
	],
] as const) {
	ruleStory.it(
		`effect/boundary reports a runMain that ${form} hides and the Effect runner beside it`,
		[
			repositoryHas({
				content: `import * as NodeRuntime from "@effect/platform-node/NodeRuntime";\nimport { Effect } from "effect";\nexport const result = Effect.runSync(work);\n${helper}\n`,
				path: "src/start.ts",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			yield* assertThat(findings, (actual) =>
				actual.toEqual([
					usesAt("src/start.ts", 3, "effect.Effect.runSync outside an entry point"),
					usesAt("src/start.ts", line, "@effect/platform-node/NodeRuntime.runMain outside an entry point"),
				]),
			);
		},
		CLI_TIMEOUT,
	);
}
