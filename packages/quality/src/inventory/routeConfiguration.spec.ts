import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";

for (const [name, path, content, problem] of [
	["malformed JSON", "tsr.config.json", "{", "cannot read routes from"],
	["an invalid directory", "tsr.config.json", '{"routesDirectory":1}', "routesDirectory"],
	["an invalid ignore pattern", "tsr.config.json", '{"routeFileIgnorePattern":"["}', "cannot resolve TanStack Router folders"],
	[
		"computed plugin options",
		"vite.config.ts",
		'import { tanstackRouter } from "@tanstack/router-plugin/vite"; tanstackRouter(options);',
		"Use literal TanStack Router options",
	],
	[
		"spread plugin options",
		"vite.config.ts",
		'import { tanstackRouter } from "@tanstack/router-plugin/vite"; tanstackRouter({ ...options });',
		"Move spread TanStack Router options",
	],
] as const) {
	ruleStory.it(
		`the gate explains why it cannot read routes from ${name}`,
		[qualityInstalled(), repositoryHas({ content, path }, { content: "export const value = 1;", path: "src/value.ts" })],
		function* ({ gate, gateOutcome, gateReport }) {
			yield* gate();

			yield* withMatchers((expect) =>
				outcomes([
					["outcome", () => gateOutcome(), "invalid"],
					["explanation", () => gateReport(), expect.stringContaining(problem)],
				]),
			);
		},
	);
}
