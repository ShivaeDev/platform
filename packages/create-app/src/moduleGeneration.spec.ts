import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { bookmarksRecipe } from "#test/bookmarksRecipe.ts";
import { generated, linkedPackageScripts } from "#test/traits.ts";

for (const flags of [[], ["--minimal"]] as const) {
	application.it(
		`a generated ${flags.length === 0 ? "full" : "minimal"} app builds and passes TypeScript with its server module list`,
		[linkedPackageScripts, generated("my-app", "--no-git", ...flags)],
		function* ({ build, typecheck }) {
			yield* outcomes([
				["TypeScript", () => typecheck(), "passed"],
				["browser build", () => build(), "passed"],
			]);
		},
		120_000,
	);
}

application.it(
	"the add-a-feature registration recipe typechecks in a generated app",
	[linkedPackageScripts, generated("my-app", "--no-git"), bookmarksRecipe],
	function* ({ typecheck }) {
		expect(yield* typecheck()).toBe("passed");
	},
	120_000,
);
