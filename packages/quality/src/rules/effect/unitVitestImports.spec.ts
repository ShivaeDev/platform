import { adapterImports } from "#rules/effect/adapterImports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const path of ["src/parse.unit.test.ts", "src/ordering.unit.spec.ts"]) {
	ruleStory.it(
		`effect/adapter-imports accepts plain Vitest registration and assertions in ${path}`,
		[
			repositoryHas(
				{ content: '{"peerDependencies":{"vitest":"*"}}', path: "package.json" },
				{ content: 'import { expect, it } from "vitest";\nit("parses", () => expect(1).toBe(1));', path },
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(adapterImports), (actual) => actual.toEqual([]));
		},
	);
}
