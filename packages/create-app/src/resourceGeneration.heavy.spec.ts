import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases, linkedPackageScripts } from "#test/traits.ts";

for (const [flags, names] of [
	[[], ["bookmarks", "class"]],
	[["--minimal"], ["reading-lists", "item"]],
] as const) {
	application.it(
		`resources generated in a ${flags.length === 0 ? "full" : "minimal"} app typecheck, lint and pass their PostgreSQL host stories`,
		[linkedPackageScripts, generatedWithOwnDatabases("--no-git", ...flags), databasesPrepared],
		function* ({ addResource, lint, runResourceStories, typecheck }) {
			yield* outcomes(names.map((name) => [name, () => addResource(name), "added"] as const));

			yield* outcomes([
				["TypeScript", () => typecheck(), "passed"],
				["lint", () => lint(), "passed"],
				["generated PostgreSQL stories", () => runResourceStories(...names), "passed"],
			]);
		},
		120_000,
	);
}
