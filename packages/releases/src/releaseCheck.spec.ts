import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import {
	changelogEdited,
	changelogReset,
	headingDated,
	historyRewritten,
	laterChangeset,
	pending,
	rangeSet,
	released,
	versionSet,
} from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

workspace.it("check accepts a release derived from the changesets it deleted from main", [pending(), released], function* ({ check }) {
	expect(yield* check()).toBe("valid");
});

workspace.it(
	"check accepts a changeset added after the release as pending",
	[pending(), released, laterChangeset("later", { [CORE]: "patch" }, "### Fixed\n\n- A later fix.\n")],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

for (const [description, note] of [
	["dropped", ""],
	["altered", "- A different feature.\n"],
] as const) {
	workspace.it(
		`check refuses ${CORE}'s release whose consumed note is ${description} in the changelog`,
		[pending(), released, changelogEdited(CORE, "- A new feature.\n", note)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${CORE}: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.`,
			);
		},
	);
}

workspace.it(
	"check refuses a release whose consumed feature.md is added back as pending",
	[pending(), released, laterChangeset("feature", { [CORE]: "minor" })],
	function* ({ check }) {
		expect(yield* check()).toBe("refused: A release needs deleted pending changesets from the base; restore versions and run releases apply.");
	},
);

for (const [role, name] of [
	["the released", CORE],
	["the unreleased", "@test/dev"],
] as const) {
	workspace.it(
		`check refuses rewritten released history in ${role} ${name}'s changelog during a release`,
		[pending(), released, historyRewritten(name)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${name}: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.`,
			);
		},
	);
}

workspace.it(
	`check refuses a release that drops ${CORE}'s new notes and heading`,
	[pending(), released, changelogReset(CORE)],
	function* ({ check }) {
		expect(yield* check()).toBe(
			`refused: ${CORE}: release notes differ from releases apply; restore the new changelog heading and rerun releases apply.`,
		);
	},
);

for (const [name, version, why] of [
	["@test/dev", "1.0.1", "an unplanned release"],
	[CORE, "0.4.0", "a different version than planned"],
	["@test/peer", "1.0.0", "a skipped dependent release"],
] as const) {
	workspace.it(`check refuses ${name} at ${version}, ${why}`, [pending(), released, versionSet(name, version)], function* ({ check }) {
		expect(yield* check()).toBe(
			`refused: ${name}: version differs from the release plan; restore versions and rerun releases apply, including published dependents.`,
		);
	});
}

for (const [dependent, dependency, range, from, to] of [
	["@test/optional", "@test/api", "^0.5.0", "0.5.0", "0.5.1"],
	["@test/peer", "@test/optional", "workspace:1.0.0", "1.0.0", "1.0.1"],
] as const) {
	workspace.it(
		`check refuses ${dependent}'s release while it still pins ${dependency} ${from} and ${dependency} releases ${to}`,
		[pending(), released, rangeSet(dependent, dependency, range)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${dependent}: ${dependency} ${range} pins ${from} but the release plan advances ${dependency} to ${to}; restore versions and rerun releases apply.`,
			);
		},
	);
}

workspace.it(
	"check refuses @test/api's release heading dated 2026-02-30",
	[pending(), released, headingDated("@test/api", "2026-02-30")],
	function* ({ check }) {
		expect(yield* check()).toBe("refused: Use a valid UTC YYYY-MM-DD release date in every new changelog heading; rerun releases apply.");
	},
);

workspace.it(
	`check refuses ${CORE}'s release heading dated 2026-01-02 while the other release headings carry today's date`,
	[pending(), released, headingDated(CORE, "2026-01-02")],
	function* ({ check }) {
		expect(yield* check()).toBe("refused: Use the same UTC release date in every new changelog heading; rerun releases apply.");
	},
);
