import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE, HISTORY, RELEASED_HISTORY } from "#test/fixture.ts";
import { changeset, directoryInstructions, pending, privateWithoutChangelog, rangeSet } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const fixForBoth = changeset(
	"z-last",
	{ [CORE]: "patch", "@test/api": "patch" },
	"### Fixed\n\n- A fix for both packages.\n\n### Changed\n\n- Changed behavior.\n",
);
const breakingFirst = changeset("a-first", { [CORE]: "minor" }, "### Breaking\n\n- Breaking behavior.\n\n### Added\n\n- First alphabetically.\n");

workspace.it(
	`apply prepends ${CORE}'s 0.3.0 notes dated today in UTC above its released history, grouped Added, Changed, Fixed, Breaking with changesets in filename order`,
	[pending(), fixForBoth, breakingFirst],
	function* ({ apply, changelog, todayInUtc }) {
		expect(yield* changelog(CORE)).toBe(HISTORY);

		yield* apply();

		expect(yield* changelog(CORE)).toBe(
			`# Changelog\n\n## 0.3.0 - ${yield* todayInUtc()}\n\n### Added\n\n- First alphabetically.\n- A new feature.\n\n### Changed\n\n- Changed behavior.\n\n### Fixed\n\n- A fix for both packages.\n\n### Breaking\n\n- Breaking behavior.\n\n${RELEASED_HISTORY}`,
		);
	},
);

workspace.it("apply adds a changeset's notes to every package it names", [pending(), fixForBoth], function* ({ apply, changelog, todayInUtc }) {
	expect(yield* changelog("@test/api")).toBe(HISTORY);

	yield* apply();

	expect(yield* changelog("@test/api")).toBe(
		`# Changelog\n\n## 0.5.1 - ${yield* todayInUtc()}\n\n### Changed\n\n- Changed behavior.\n\n### Fixed\n\n- A fix for both packages.\n\n${RELEASED_HISTORY}`,
	);
});

workspace.it(
	"apply gives @test/optional, a dependent without notes of its own, a dependency release note",
	[pending()],
	function* ({ apply, changelog, todayInUtc }) {
		expect(yield* changelog("@test/optional")).toBe(HISTORY);

		yield* apply();

		expect(yield* changelog("@test/optional")).toBe(
			`# Changelog\n\n## 1.0.1 - ${yield* todayInUtc()}\n\n### Changed\n\n- Release with updated workspace dependencies.\n\n${RELEASED_HISTORY}`,
		);
	},
);

workspace.it("apply sets every released package's version from the plan", [pending()], function* ({ apply, version }) {
	yield* outcomes({
		[CORE]: [version(CORE), "0.2.3"],
		"@test/api": [version("@test/api"), "0.5.0"],
		"@test/optional": [version("@test/optional"), "1.0.0"],
		"@test/peer": [version("@test/peer"), "1.0.0"],
	});

	yield* apply();

	yield* outcomes({
		[CORE]: [version(CORE), "0.3.0"],
		"@test/api": [version("@test/api"), "0.5.1"],
		"@test/optional": [version("@test/optional"), "1.0.1"],
		"@test/peer": [version("@test/peer"), "1.0.1"],
	});
});

for (const { dependency, dependent, field, range, released, to } of [
	{ dependency: CORE, dependent: "@test/api", field: "dependencies", range: "workspace:*", released: "0.5.1", to: "workspace:*" },
	{ dependency: CORE, dependent: "@test/api", field: "dependencies", range: "workspace:^", released: "0.5.1", to: "workspace:^" },
	{ dependency: CORE, dependent: "@test/api", field: "dependencies", range: "workspace:~", released: "0.5.1", to: "workspace:~" },
	{ dependency: CORE, dependent: "@test/api", field: "dependencies", range: "^0.2.3", released: "0.5.1", to: "^0.3.0" },
	{ dependency: "@test/api", dependent: "@test/optional", field: "optionalDependencies", range: "^0.5.0", released: "1.0.1", to: "^0.5.1" },
	{ dependency: "@test/api", dependent: "@test/optional", field: "optionalDependencies", range: "~0.5.0", released: "1.0.1", to: "~0.5.1" },
	{ dependency: "@test/api", dependent: "@test/optional", field: "optionalDependencies", range: "0.5.0", released: "1.0.1", to: "0.5.1" },
	{
		dependency: "@test/optional",
		dependent: "@test/peer",
		field: "peerDependencies",
		range: "workspace:1.0.0",
		released: "1.0.1",
		to: "workspace:1.0.1",
	},
]) {
	workspace.it(
		`apply releases ${dependent} as ${released} and ${range === to ? "keeps" : "advances"} its ${range} ${field} range on ${dependency}${range === to ? "" : ` to ${to}`}`,
		[pending(), rangeSet(dependent, dependency, range)],
		function* ({ apply, dependencyRange, version }) {
			expect(yield* dependencyRange(dependent, dependency)).toBe(`${range} in ${field}`);

			yield* apply();

			yield* outcomes({
				range: [dependencyRange(dependent, dependency), `${to} in ${field}`],
				version: [version(dependent), released],
			});
		},
	);
}

workspace.it(
	"apply deletes the changesets it consumed and keeps .changeset/README.md",
	[pending(), fixForBoth, breakingFirst, directoryInstructions],
	function* ({ apply, changesetFiles }) {
		expect(yield* changesetFiles()).toEqual(["README.md", "a-first.md", "feature.md", "z-last.md"]);

		yield* apply();

		expect(yield* changesetFiles()).toEqual(["README.md"]);
	},
);

workspace.it(
	`apply releases ${CORE} and leaves @test/private, its private dependent without a changelog, untouched`,
	[pending(), privateWithoutChangelog],
	function* ({ apply, changelog, manifestFile, version }) {
		const manifest = yield* manifestFile("@test/private");

		yield* apply();

		yield* outcomes({
			[`${CORE}'s version`]: [version(CORE), "0.3.0"],
			"@test/private's changelog": [changelog("@test/private"), "no changelog"],
			"@test/private's manifest": [manifestFile("@test/private"), manifest],
		});
	},
);

workspace.it("apply with no changesets answers that nothing is pending and writes nothing", [], function* ({ apply, lastAnswer, workspaceFiles }) {
	const files = yield* workspaceFiles();

	yield* apply();

	yield* outcomes({
		answer: [lastAnswer(), ["No pending releases."]],
		"workspace files": [workspaceFiles(), files],
	});
});
