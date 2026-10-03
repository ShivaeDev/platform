import { defineConfig } from "./packages/quality/src/config.ts";

const PACKAGE_ENTRIES = [
	"packages/*/src/index.ts",
	"packages/effect-form/src/react.ts",
	"packages/effect-react/src/form.ts",
	"packages/effect-prisma/src/sqlite.ts",
	"packages/effect-prisma/src/testing.ts",
	"packages/effect-trpc/src/client.ts",
	"packages/effect-trpc/src/testing.ts",
	"packages/platform/src/better-auth.ts",
	"packages/platform/src/errors.ts",
	"packages/platform/src/node-http.ts",
	"packages/platform/src/rpc-server.ts",
	"packages/platform/src/rpc.ts",
	"packages/platform/src/runtime.ts",
	"packages/platform/src/testing.ts",
] as const;

export default defineConfig({
	adopt: ["biome"],
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
						includes: ["**", "!**/test/generated", "!**/test/*/generated"],
						reason: "Generated test clients are not source.",
					},
					{
						rule: "lint/performance/noBarrelFile",
						includes: PACKAGE_ENTRIES,
						reason: "Package entry points are the files that re-export a package's public modules.",
					},
					{
						rule: "lint/performance/noReExportAll",
						includes: PACKAGE_ENTRIES,
						reason: "Package entry points are the files that re-export a package's public modules.",
					},
					{
						rule: "lint/style/noDefaultExport",
						includes: [".dependency-cruiser.ts"],
						reason: "dependency-cruiser loads its config file through the default export.",
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
