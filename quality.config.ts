import { defineConfig } from "./packages/quality/src/config.ts";

export default defineConfig({
	sources: ["packages", "script"],
	rules: {
		"suppressions/no-inline": {
			options: {
				declared: [
					{
						directive: "@ts-expect-error",
						includes: ["*.typecheck.ts"],
						reason:
							"Type tests prove that an API rejects what its types forbid. TypeScript has no other way to assert a compile error, and each directive fails typecheck as soon as the error it expects goes away.",
					},
				],
			},
		},
		"suppressions/biome-overrides": {
			options: {
				declared: [
					{
						rule: "files/includes",
						includes: ["**", "!**/.pnpm-store", "!**/dist", "!**/coverage", "!**/test/generated", "!**/test/*/generated", "!!.worktrees"],
						reason: "Package-manager stores, build output, coverage reports, generated test clients and linked worktrees are not source.",
					},
					{
						rule: "lint/suspicious/noExplicitAny",
						includes: ["packages/effect-test/src/any-test-layer.ts", "packages/effect-trpc/src/testing/any-test-layer.ts"],
						reason:
							"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer.",
					},
					{
						rule: "lint/suspicious/noThenProperty",
						includes: ["packages/effect-prisma/test/support/controlled-collection.ts"],
						reason:
							"Test doubles for Prisma Next's AsyncIterableResult, a lazy thenable that is also async-iterable. The relation runtime must be exercised against that exact shape, so the doubles define then() and run their query on each consumption.",
					},
					{
						rule: "lint/correctness/noEmptyPattern",
						includes: ["packages/effect-test/src/vitest.ts"],
						reason:
							"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The worker-scoped Layer fixture depends on none, so its pattern is empty.",
					},
				],
			},
		},
	},
});
