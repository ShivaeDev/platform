import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { separateAdminRegistry, unifiedAdminRegistry } from "#test/moduleRegistry.ts";
import { updates } from "#test/updates.ts";
import { createdWith010, published010 } from "#test/updateTraits.ts";
import { legacyWorkerRegistry, moduleWorkers } from "#test/workerRegistry.ts";

for (const flags of [[], ["--minimal"]] as const) {
	updates.it(
		`an upgraded ${flags.length === 0 ? "full" : "minimal"} app builds and passes TypeScript after consolidating its feature registration`,
		[separateAdminRegistry, legacyWorkerRegistry, createdWith010(...flags), published010, unifiedAdminRegistry, moduleWorkers],
		function* ({ build, conflictedFiles, exitCode, exists, typecheck, update }) {
			yield* update();

			yield* outcomes([
				["upgrade exit code", () => exitCode(), 0],
				["merge conflicts", () => conflictedFiles(), []],
				["obsolete worker list", () => exists("src/server/workerModules.ts"), false],
				["TypeScript", () => typecheck(), "passed"],
				["browser build", () => build(), "passed"],
			]);
		},
		120_000,
	);
}
