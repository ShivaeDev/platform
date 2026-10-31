import { expect } from "vitest";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { boundaryShapes } from "#test/boundaryShapes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const { code, found, name } of boundaryShapes) {
	for (const path of ["src/work.ts", "src/adapters/work.ts"]) {
		ruleStory.it(
			`effect/boundary ${path.includes("adapters/") ? "accepts" : "reports"} ${name} in ${path}`,
			[repositoryHas({ content: code, path })],
			function* ({ check }) {
				const findings = yield* check(effectBoundary);

				expect(findings).toEqual(path.includes("adapters/") ? [] : found.map(([line, construct]) => usesAt(path, line, construct)));
			},
			CLI_TIMEOUT,
		);
	}
}

for (const path of [
	"src/cli.ts",
	"src/main.ts",
	"src/client/main.tsx",
	"src/client/entry.tsx",
	"src/tool-cli.ts",
	"tool.config.ts",
	"src/pure.unit.test.ts",
]) {
	ruleStory.it(
		`effect/boundary accepts runners at ${path}`,
		[repositoryHas({ content: 'import { Effect } from "effect";\nexport const result = Effect.runSync(work);', path })],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			expect(findings).toEqual([]);
		},
		CLI_TIMEOUT,
	);
}

for (const path of ["src/work.ts", "src/adapters/work.ts"]) {
	ruleStory.it(
		`effect/boundary reports a core guard's throw and ${path.includes("adapters/") ? "accepts" : "counts"} all 31 calls in ${path}`,
		[
			repositoryHas(
				{
					content: 'export function guard(value: unknown): void;\nexport function guard(value: unknown) { if (!value) throw new Error("missing"); }',
					path: "src/guard.ts",
				},
				{
					content: [
						`import { guard as check } from "${path.includes("adapters/") ? "../guard.ts" : "./guard.ts"}";`,
						...Array.from({ length: 31 }, () => "check(input);"),
					].join("\n"),
					path,
				},
			),
		],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			expect(findings).toEqual([
				usesAt("src/guard.ts", 2, "throw statement"),
				...(path.includes("adapters/") ? [] : Array.from({ length: 31 }, (_, index) => usesAt(path, index + 2, "throwing helper call (check)"))),
			]);
		},
		CLI_TIMEOUT,
	);
}

ruleStory.it(
	"effect/boundary reports a throwing guard inside Effect.sync at both boundaries",
	[
		repositoryHas({
			content: 'import { Effect } from "effect";\nfunction guard() { throw new Error("missing"); }\nexport const read = Effect.sync(() => guard());',
			path: "src/work.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		expect(findings).toEqual([
			usesAt("src/work.ts", 2, "throw statement"),
			usesAt("src/work.ts", 3, "Effect.sync with a throwing body"),
			usesAt("src/work.ts", 3, "throwing helper call (guard)"),
		]);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts pure callbacks, deferred throws and unrelated API names",
	[
		repositoryHas({
			content:
				'import { Effect } from "effect";\nconst fs = { readFileSync: () => "pure" };\nfunction deferred() { return () => { throw new Error("later"); }; }\nexport const read = Effect.sync(() => fs.readFileSync());\nexport const later = Effect.sync(deferred);',
			path: "src/work.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(effectBoundary);

		expect(findings).toEqual([usesAt("src/work.ts", 3, "throw statement")]);
	},
	CLI_TIMEOUT,
);
