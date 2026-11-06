import { expect } from "@effect/vitest";
import { contextCapture } from "#rules/effect/contextCapture.ts";
import { compositionFiles } from "#test/compositionFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const path of ["apps/server/src/fixture-main.ts", "apps/testing/src/application-story.ts", "src/bootstrap.ts"]) {
	for (const assembled of [true, false]) {
		ruleStory.it(
			`context capture ${assembled ? "accepts a Layer assembled environment" : "rejects an ambient environment"} in ${path}`,
			[effectResolves(), repositoryHas(compositionFiles(path, assembled))],
			function* ({ check }) {
				const findings = yield* check(contextCapture);

				expect(findings).toEqual(assembled ? [] : [expect.objectContaining({ file: path })]);
			},
		);
	}
}

for (const [name, provision, accepted] of [
	["a fully provided application", "Effect.provide(live), Effect.scoped", true],
	["a partially provided application", "Effect.provide(Layer.empty), Effect.scoped", false],
] as const) {
	ruleStory.it(
		`context capture distinguishes ${name} from an ambient service environment`,
		[effectResolves(), repositoryHas(compositionFiles("src/application.ts", false, provision))],
		function* ({ check }) {
			expect(yield* check(contextCapture)).toEqual(accepted ? [] : [expect.objectContaining({ file: "src/application.ts" })]);
		},
	);
}
