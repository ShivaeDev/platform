import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE, HISTORY } from "#test/fixture.ts";
import { changelogReading, pending, rangeSet } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

workspace.it(
	"apply refuses @test/optional's >=0.5.0 <1 range on @test/api, names the supported forms and writes nothing",
	[pending(), rangeSet("@test/optional", "@test/api", ">=0.5.0 <1")],
	function* ({ apply, lastAnswer, workspaceFiles }) {
		const files = yield* workspaceFiles();

		yield* apply();

		yield* outcomes({
			answer: [
				lastAnswer(),
				"refused: @test/optional: replace @test/api's >=0.5.0 <1 range with an exact version, ^version, ~version or workspace:* before applying a release.",
			],
			"workspace files": [workspaceFiles(), files],
		});
	},
);

for (const [description, text] of [
	["has no '# Changelog' title", "# Notes\n"],
	["keeps an Unreleased section", "# Changelog\n\n## Unreleased\n\n### Added\n\n- A pending entry.\n"],
] as const) {
	workspace.it(
		`apply refuses ${CORE}'s changelog that ${description}, explains the released-history format and writes nothing`,
		[pending(), changelogReading(CORE, description, text)],
		function* ({ apply, lastAnswer, workspaceFiles }) {
			const files = yield* workspaceFiles();

			yield* apply();

			yield* outcomes({
				answer: [lastAnswer(), `refused: ${CORE}: use a '# Changelog' title and move Unreleased notes into .changeset/*.md.`],
				"workspace files": [workspaceFiles(), files],
			});
		},
	);
}

workspace.it(
	`apply refuses to collect ${CORE}'s 0.3.0 when its changelog already has 0.3.0 notes`,
	[
		pending(),
		changelogReading(
			CORE,
			"already has 0.3.0 notes",
			HISTORY.replace("# Changelog\n", "# Changelog\n\n## 0.3.0 - 2026-02-01\n\n### Added\n\n- Earlier notes.\n"),
		),
	],
	function* ({ apply }) {
		expect(yield* apply()).toBe(`refused: ${CORE}: version 0.3.0 already has notes; restore the package version and rerun releases apply.`);
	},
);
