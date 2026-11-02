import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE } from "#test/fixture.ts";
import { ROOT, rootHistoryRewritten, rootPackage } from "#test/rootPackage.ts";
import { onMain, pending, released } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const packages of [["."], [".", "packages/*"]]) {
	workspace.it(
		`a root package selected by ${packages.join(" and ")} validates before and after its planned release is applied`,
		[rootPackage(packages), pending({ [ROOT]: "minor" }), onMain],
		function* ({ plan, apply, check }) {
			yield* outcomes([
				["planned release", plan, [`${ROOT}: 0.2.3 -> 0.3.0 (minor)`]],
				["pending validation", check, "valid"],
			]);

			yield* apply();

			yield* outcomes([
				["remaining releases", plan, ["No pending releases."]],
				["release validation", check, "valid"],
			]);
		},
	);
}

workspace.it(
	"a workspace package release validates while the root package stays unchanged",
	[rootPackage([".", "packages/*"]), pending(), released],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

workspace.it(
	"check refuses rewritten root package history without a release",
	[rootPackage(["."]), onMain, rootHistoryRewritten],
	function* ({ check }) {
		expect(yield* check()).toBe(`refused: ${ROOT}: CHANGELOG.md changes require a version bump; add .changeset/<name>.md and run releases apply.`);
	},
);

workspace.it(
	"check refuses rewritten root package history during a workspace release",
	[rootPackage([".", "packages/*"]), pending({ [CORE]: "minor" }), released, rootHistoryRewritten],
	function* ({ check }) {
		expect(yield* check()).toBe(
			`refused: ${ROOT}: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.`,
		);
	},
);
