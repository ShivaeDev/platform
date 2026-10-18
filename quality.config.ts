import { defineConfig } from "@shivaedev/quality/config.ts";
import { catalogOnly } from "#quality/catalogOnly.ts";
import { catalogOverrides } from "#quality/catalogOverrides.ts";
import { codecovComponents } from "#quality/codecovComponents.ts";
import { exactCatalogVersion } from "#quality/exactCatalogVersion.ts";
import { unreadable } from "#quality/unreadable.ts";
import { workspaceSection } from "#quality/workspaceSection.ts";

export default defineConfig({
	exceptions: [
		{
			"files": ["**", "!**/test-support/generated", "!**/test-support/*/generated"],
			"reason": "Generated test clients are not source.",
			"rules": ["biome/files/includes"],
		},
		{
			"files": ["packages/effect-test/src/any-test-layer.ts", "packages/effect-trpc/src/server/testing/AnyTestLayer.ts"],
			"reason":
				"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer. effect-test's bound adds a never-output member so it also takes a Layer that provides nothing, such as Layer.empty.",
			"rules": ["biome/lint/suspicious/noExplicitAny"],
		},
		{
			"files": ["packages/effect-prisma/src/test-support/controlled-collection.ts"],
			"reason":
				"Test doubles for Prisma Next's AsyncIterableResult, a lazy thenable that is also async-iterable. The relation runtime must be exercised against that exact shape, so the doubles define then() and run their query on each consumption.",
			"rules": ["biome/lint/suspicious/noThenProperty"],
		},
		{
			"files": ["packages/effect-test/src/vitest.ts"],
			"reason":
				"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The worker-scoped Layer fixture depends on none, so its pattern is empty.",
			"rules": ["biome/lint/correctness/noEmptyPattern"],
		},
	],
	local: [catalogOnly, catalogOverrides, codecovComponents, exactCatalogVersion, unreadable, workspaceSection],
	rules: {
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/src/test-support/generated"] } },
	},
	sources: ["packages", "examples", "script"],
});
