import { defineConfig } from "./packages/quality/src/config.ts";

export default defineConfig({
	rules: {
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/src/test-support/generated"] } },
		"suppressions/biome-overrides": {
			options: {
				declared: [
					{
						includes: ["**", "!**/test-support/generated", "!**/test-support/*/generated"],
						reason: "Generated test clients are not source.",
						rule: "files/includes",
					},
					{
						includes: ["packages/effect-test/src/any-test-layer.ts", "packages/effect-trpc/src/testing/any-test-layer.ts"],
						reason:
							"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer. effect-test's bound adds a never-output member so it also takes a Layer that provides nothing, such as Layer.empty.",
						rule: "lint/suspicious/noExplicitAny",
					},
					{
						includes: ["packages/effect-prisma/src/test-support/controlled-collection.ts"],
						reason:
							"Test doubles for Prisma Next's AsyncIterableResult, a lazy thenable that is also async-iterable. The relation runtime must be exercised against that exact shape, so the doubles define then() and run their query on each consumption.",
						rule: "lint/suspicious/noThenProperty",
					},
					{
						includes: ["packages/effect-test/src/vitest.ts"],
						reason:
							"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The worker-scoped Layer fixture depends on none, so its pattern is empty.",
						rule: "lint/correctness/noEmptyPattern",
					},
				],
			},
		},
	},
	sources: ["packages", "script"],
});
