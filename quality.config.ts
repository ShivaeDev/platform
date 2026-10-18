import { defineConfig } from "@shivaedev/quality/config.ts";
import { catalogOnly } from "#quality/catalogOnly.ts";
import { catalogOverrides } from "#quality/catalogOverrides.ts";
import { codecovComponents } from "#quality/codecovComponents.ts";
import { exactCatalogVersion } from "#quality/exactCatalogVersion.ts";
import { migrationConvention } from "#quality/migrationConvention.ts";
import { unreadable } from "#quality/unreadable.ts";
import { workspaceSection } from "#quality/workspaceSection.ts";

export default defineConfig({
	exceptions: [
		{
			"files": ["**", "!**/test-support/generated", "!**/test-support/*/generated", "!examples/starter"],
			"reason": "Generated test clients are not source. The starter has a nested Biome config and runs its own Quality gate.",
			"rules": ["biome/files/includes"],
		},
		{
			"files": ["packages/effect-test/src/anyTestLayer.ts", "packages/effect-trpc/src/server/testing/AnyTestLayer.ts"],
			"reason":
				"effect-test declares the shared test Layer bound; effect-trpc preserves the same type at its public compatibility path. Layer's output slot is contravariant, so a never-only bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any preserves service inference, and the never-output member accepts Layers that provide nothing, such as Layer.empty.",
			"rules": ["biome/lint/suspicious/noExplicitAny"],
		},
		{
			"files": ["packages/effect-prisma/src/test-support/FakeResult.ts"],
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
		{
			files: [
				"packages/work-board-plugin/src/boardStream.spec.ts",
				"packages/work-board-plugin/src/boardSummary.spec.ts",
				"packages/work-board-plugin/src/toolAnswers.spec.ts",
			],
			reason:
				"These specs cover the plugin's pure parsing and shaping functions, which have no engine behind them: the only engine is Claude Code, which test-story cannot drive.",
			rules: ["tests/story-specs"],
		},
		{
			files: ["packages/work-board-plugin/src/claude-code.d.ts"],
			reason: "TypeScript looks up the JSX namespace by that exact name to type the plugin's JSX against Claude Code's elements.",
			rules: ["biome/lint/style/useNamingConvention"],
		},
		{
			files: [
				"packages/work-board-plugin/src/connect.ts",
				"packages/work-board-plugin/src/findBoard.ts",
				"packages/work-board-plugin/src/flights.tsx",
				"packages/work-board-plugin/src/goalRows.tsx",
				"packages/work-board-plugin/src/pane.tsx",
				"packages/work-board-plugin/src/register.tsx",
				"packages/work-board-plugin/src/registerTools.ts",
				"packages/work-board-plugin/src/serveTools.ts",
			],
			reason: "claude-code is the module Claude Code provides to a mod at runtime, not an npm dependency the package could declare.",
			rules: ["biome/lint/correctness/noUndeclaredDependencies"],
		},
	],
	local: [catalogOnly, catalogOverrides, codecovComponents, exactCatalogVersion, migrationConvention, unreadable, workspaceSection],
	rules: {
		"boundaries/auth-sql": { options: { owners: ["packages/platform/src/server/better-auth/**"] } },
		"boundaries/http-status": { options: { edge: ["packages/platform/src/server/rpc-server/**", "packages/platform/src/server/node-http/**"] } },
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/src/test-support/generated"] } },
		"tests/support-imports": {
			options: {
				modules: [
					"packages/effect-sql/src/advisoryXactLock.ts",
					"packages/effect-sql/src/transact.ts",
					"packages/quality/src/biome/report.ts",
					"packages/quality/src/cli/program.ts",
					"packages/quality/src/cli/runMain.ts",
					"packages/quality/src/config.ts",
					"packages/quality/src/engine/violation.ts",
					"packages/quality/src/imports/fences/dsl.ts",
					"packages/quality/src/imports/fences/selectors.ts",
					"packages/quality/src/inventory/collect.ts",
					"packages/quality/src/rule.ts",
					"packages/quality/src/rules/suppressions/biomeOverrides.ts",
					"packages/test-story/src/server/storyKit.ts",
					"packages/platform/src/server/appHost.ts",
					"examples/starter/src/server/notesHost.ts",
					"examples/starter/src/notes.ts",
					"examples/starter/src/server/noteJobs.ts",
				],
			},
		},
	},
	sources: ["packages", "examples", "script"],
});
