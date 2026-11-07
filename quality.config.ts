import { defineConfig } from "@shivaedev/quality/config.ts";
import { catalogOnly } from "#quality/catalogOnly.ts";
import { catalogOverrides } from "#quality/catalogOverrides.ts";
import { exactCatalogVersion } from "#quality/exactCatalogVersion.ts";
import { libraryTiers } from "#quality/libraryTiers.ts";
import { migrationConvention } from "#quality/migrationConvention.ts";
import { serverKitImports } from "#quality/serverKitImports.ts";
import { starterBaseline } from "#quality/starterBaseline.ts";
import { unreadable } from "#quality/unreadable.ts";
import { workspaceSection } from "#quality/workspaceSection.ts";

export default defineConfig({
	exceptions: [
		{
			"files": ["**", "!**/test-support/generated", "!**/test-support/*/generated", "!examples/starter"],
			"reason": "Generated clients are not source. The starter has a nested Biome config and runs its own Quality gate.",
			"rules": ["biome/files/includes"],
		},
		{
			"files": ["packages/test/src/types.ts"],
			"reason":
				"test declares the shared test Layer bound. Layer's output slot is contravariant, so a never-only bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any preserves service inference, and the never-output member accepts Layers that provide nothing, such as Layer.empty.",
			"rules": ["biome/lint/suspicious/noExplicitAny"],
		},
		{
			"files": ["packages/test/src/adapters/makeEffectIt.ts"],
			"reason":
				"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The file-scoped Layer fixture depends on none, so its pattern is empty.",
			"rules": ["biome/lint/correctness/noEmptyPattern"],
		},
	],
	local: [
		catalogOnly,
		catalogOverrides,
		exactCatalogVersion,
		libraryTiers,
		migrationConvention,
		serverKitImports,
		starterBaseline,
		unreadable,
		workspaceSection,
	],
	rules: {
		"boundaries/auth-sql": {
			options: {
				owners: [
					{ glob: "packages/identity/src/server/better-auth/**", reason: "Identity owns Better Auth storage and provider integration." },
					{ glob: "examples/starter/src/server/migrations/0001_auth.ts", reason: "This migration creates the Better Auth tables." },
					{
						glob: "examples/starter/src/server/migrations/0004_stored_roles.ts",
						reason: "This migration normalizes stored Better Auth roles.",
					},
				],
			},
		},
		"boundaries/http-status": {
			options: {
				edge: [
					{
						glob: "script/package-check/adapters/pinnedTarballs.ts",
						reason: "The npm adapter selects unpublished release archives from registry responses.",
					},
					{
						glob: "packages/discord/src/adapters/restStatus.ts",
						reason: "Discord's REST adapter classifies provider rate limits before reading their retry delay.",
					},
					{ glob: "packages/github/src/status.ts", reason: "This HTTP adapter translates transport statuses into domain errors." },
					{ glob: "packages/identity/src/server/**", reason: "This HTTP adapter translates transport statuses into domain errors." },
					{
						glob: "packages/identity/src/test-support/better-auth/database.ts",
						reason: "This HTTP story adapter translates Better Auth responses into storage outcomes.",
					},
					{
						glob: "packages/identity/src/test-support/native-sessions/originVerbs.ts",
						reason: "This HTTP story adapter translates origin-check responses into caller outcomes.",
					},
					{ glob: "packages/pr-watch/src/requestFailure.ts", reason: "This HTTP adapter translates transport statuses into domain errors." },
					{
						glob: "packages/identity/src/client/adapters/authCall.ts",
						reason: "This Better Auth client adapter translates HTTP rate limits into typed AuthFailure errors.",
					},
				],
			},
		},
	},
	sources: [".agents", "AGENTS.md", "README.md", "docs", "examples", "packages", "script"],
});
