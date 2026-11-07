import { expect } from "@effect/vitest";
import { contextCapture } from "#rules/effect/contextCapture.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [name, content] of [
	[
		"the native Context overload of provide",
		'import { Context, Effect } from "effect"; const captured = Context.empty(); Effect.provide(effect, captured);',
	],
	["provideContext", 'import { Effect } from "effect"; Effect.provideContext(effect, context);'],
	["an aliased runner", 'import { runPromiseWith as run } from "effect/Effect"; run(context)(effect);'],
	["a destructured runner", 'import * as Fx from "effect/Effect"; const { runForkWith: fork } = Fx; fork(context)(effect);'],
] as const) {
	ruleStory.it(
		`core rejects captured context through ${name}`,
		[effectResolves(), repositoryHas({ content, path: "src/run.ts" })],
		function* ({ check }) {
			const findings = yield* check(contextCapture);

			expect(findings).toEqual([
				expect.objectContaining({
					file: "src/run.ts",
					message: expect.stringContaining("Declare service requirements once and yield dependencies and the caller from the environment."),
				}),
			]);
		},
	);
}

for (const path of ["src/adapters/run.ts", "src/test-support/run.ts"]) {
	ruleStory.it(
		`runtime bridges can provide context in ${path}`,
		[effectResolves(), repositoryHas({ content: 'import { Effect } from "effect"; Effect.runPromiseWith(context)(effect);', path })],
		function* ({ check }) {
			const findings = yield* check(contextCapture);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"unrelated methods named runPromiseWith remain ordinary application code",
	[
		effectResolves(),
		repositoryHas({ content: 'const client = { runPromiseWith: (value: string) => value }; client.runPromiseWith("input");', path: "src/read.ts" }),
	],
	function* ({ check }) {
		const findings = yield* check(contextCapture);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"core can register Layers with Effect.provide",
	[
		effectResolves(),
		repositoryHas({ content: 'import { Effect, Layer } from "effect"; Effect.provide(effect, Layer.empty);', path: "src/register.ts" }),
	],
	function* ({ check }) {
		const findings = yield* check(contextCapture);

		expect(findings).toEqual([]);
	},
);
