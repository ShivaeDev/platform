import { expect } from "vitest";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const marker of [
	'import * as NodeRuntime from "@effect/platform-node/NodeRuntime"; NodeRuntime.runMain(work);',
	"runMain(work);",
	'import { fileURLToPath } from "node:url"; if (fileURLToPath(import.meta.url) === process.argv[1]) { start(); }',
]) {
	ruleStory.it(
		`effect/boundary accepts a runner in an entry module using ${marker}`,
		[repositoryHas({ content: `import { Effect } from "effect";\n${marker}\nexport const result = Effect.runSync(work);`, path: "src/start.ts" })],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			expect(findings).toEqual([]);
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

			expect(findings).toEqual([usesAt("src/work.ts", 3, "effect.Effect.runSync outside an entry point")]);
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

		expect(findings).toEqual([usesAt("src/read.ts", 2, "Promise-typed parameter (load)")]);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary still reports throws in a browser entry module",
	[repositoryHas({ content: 'import { Effect } from "effect";\nEffect.runSync(work);\nthrow new Error("missing");', path: "src/client/entry.tsx" })],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		expect(findings).toEqual([usesAt("src/client/entry.tsx", 3, "throw statement")]);
	},
);
