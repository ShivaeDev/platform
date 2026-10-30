import { expect } from "@effect/vitest";
import { outOfSync, skills } from "#test/skills.ts";
import { addedByHand, alsoSelects, copyDeleted, deselects, editedByHand, packageBumpedTo, removedByHand, selected, synced } from "#test/traits.ts";

skills.it(
	"check passes on a freshly synced alpha and beta and names the package version",
	[selected("alpha", "beta"), synced],
	function* ({ check }) {
		expect(yield* check()).toBe("The shared skills match @shivaedev/skills 1.2.0.");
	},
);

skills.it("check before the first sync reports the missing manifest", [selected("alpha")], function* ({ check }) {
	expect(yield* check()).toBe(outOfSync(".agents/skills/.shivaedev-skills.json is missing."));
});

skills.it(
	"after the installed package is bumped to 1.3.0, check reports that the skills were synced from 1.2.0",
	[selected("alpha"), synced, packageBumpedTo("1.3.0")],
	function* ({ check }) {
		expect(yield* check()).toBe(outOfSync("The skills were synced from @shivaedev/skills 1.2.0, but 1.3.0 is installed."));
	},
);

skills.it(
	"after a bump to 1.3.0, a sync makes check pass for 1.3.0",
	[selected("alpha"), synced, packageBumpedTo("1.3.0")],
	function* ({ check, sync }) {
		expect(yield* check()).toBe(outOfSync("The skills were synced from @shivaedev/skills 1.2.0, but 1.3.0 is installed."));

		yield* sync();

		expect(yield* check()).toBe("The shared skills match @shivaedev/skills 1.3.0.");
	},
);

for (const [change, trait] of [
	["SKILL.md is edited", editedByHand("alpha", "SKILL.md")],
	["references/more.md is added", addedByHand("alpha", "references/more.md")],
	["references/notes.md is removed", removedByHand("alpha", "references/notes.md")],
] as const) {
	skills.it(
		`check reports that alpha's copy differs from the sync after ${change} by hand`,
		[selected("alpha"), synced, trait],
		function* ({ check }) {
			expect(yield* check()).toBe(
				outOfSync(".agents/skills/alpha differs from what shivaedev-skills synced. Shared skills change in @shivaedev/skills, not in the copy."),
			);
		},
	);
}

skills.it(
	"check reports beta's copy missing after its folder is deleted",
	[selected("alpha", "beta"), synced, copyDeleted("beta")],
	function* ({ check }) {
		expect(yield* check()).toBe(outOfSync(".agents/skills/beta is missing."));
	},
);

skills.it(
	"check reports beta as selected but not synced after it is added to the selection",
	[selected("alpha"), synced, alsoSelects("beta")],
	function* ({ check }) {
		expect(yield* check()).toBe(outOfSync('beta is selected in "shivaedevSkills" but not synced.'));
	},
);

skills.it(
	"check reports beta as synced but no longer selected after it is dropped from the selection",
	[selected("alpha", "beta"), synced, deselects("beta")],
	function* ({ check }) {
		expect(yield* check()).toBe(outOfSync('beta is synced but no longer selected in "shivaedevSkills".'));
	},
);
