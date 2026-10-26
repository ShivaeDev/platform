import { defineConfig } from "@shivaedev/quality/config.ts";
import { catalogOnly } from "#quality/catalogOnly.ts";
import { catalogOverrides } from "#quality/catalogOverrides.ts";
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
			"files": ["packages/test/src/anyTestLayer.ts"],
			"reason":
				"test declares the shared test Layer bound. Layer's output slot is contravariant, so a never-only bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any preserves service inference, and the never-output member accepts Layers that provide nothing, such as Layer.empty.",
			"rules": ["biome/lint/suspicious/noExplicitAny"],
		},
		{
			"files": ["packages/test/src/makeEffectIt.ts"],
			"reason":
				"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The worker-scoped Layer fixture depends on none, so its pattern is empty.",
			"rules": ["biome/lint/correctness/noEmptyPattern"],
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
	local: [catalogOnly, catalogOverrides, exactCatalogVersion, migrationConvention, unreadable, workspaceSection],
	rules: {
		"boundaries/auth-sql": { options: { owners: ["packages/admin/src/server/users.ts", "packages/identity/src/server/better-auth/**"] } },
		"boundaries/http-status": {
			options: {
				edge: [
					"packages/github/src/status.ts",
					"packages/identity/src/server/**",
					"packages/pr-watch/src/requestFailure.ts",
					"packages/server/src/rpc-server/**",
					"packages/server/src/node-http/**",
				],
			},
		},
	},
	sources: ["packages", "examples", "script"],
});
