import { expect } from "@effect/vitest";
import { ALPHA, ALPHA_NOTES } from "#test/fixture.ts";
import { skills } from "#test/skills.ts";
import { manifestOverwritten, packageJsonReads, selected, synced } from "#test/traits.ts";

for (const manifest of ["{", '{"skills":[],"version":1}']) {
	skills.it(
		`sync refuses a manifest overwritten by hand with ${manifest} and says how to repair it`,
		[selected("alpha"), synced, manifestOverwritten(manifest)],
		function* ({ sync }) {
			expect(yield* sync()).toBe(
				"failed: .agents/skills/.shivaedev-skills.json is not a manifest this package wrote. Delete it and the folders it listed, then sync.",
			);
		},
	);
}

skills.it(
	"a sync refused over a damaged manifest keeps alpha's copy",
	[selected("alpha"), synced, manifestOverwritten("{")],
	function* ({ folder, sync }) {
		expect(yield* folder(".agents/skills/alpha")).toEqual({ "references/notes.md": ALPHA_NOTES, "SKILL.md": ALPHA });

		yield* sync();

		expect(yield* folder(".agents/skills/alpha")).toEqual({ "references/notes.md": ALPHA_NOTES, "SKILL.md": ALPHA });
	},
);

for (const selection of ["{", '{"shivaedevSkills":"alpha"}', '{"shivaedevSkills":[1]}']) {
	skills.it(`sync refuses a package.json reading ${selection} and names the field to fix`, [packageJsonReads(selection)], function* ({ sync }) {
		expect(yield* sync()).toBe('failed: <repository>/package.json: "shivaedevSkills" must be a list of skill names.');
	});
}
