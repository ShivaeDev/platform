import { expect } from "@effect/vitest";
import { MANIFEST, skills } from "#test/skills.ts";
import { damagedManifest, invalidSelection, selected, synced } from "#test/traits.ts";

for (const manifest of ["{", '{"skills":[],"version":1}']) {
	skills.it(
		`a damaged manifest gives repair instructions and leaves copies intact: ${manifest}`,
		[selected("alpha"), synced, damagedManifest(manifest)],
		function* ({ repository }) {
			const error = yield* repository.syncFailure();

			expect(error.message).toBe(
				".agents/skills/.shivaedev-skills.json is not a manifest this package wrote. Delete it and the folders it listed, then sync.",
			);
			expect(yield* repository.exists(".agents/skills/alpha/SKILL.md")).toBe(true);
		},
	);
}

for (const selection of ["{", '{"shivaedevSkills":"alpha"}', '{"shivaedevSkills":[1]}']) {
	skills.it(`an invalid selection names the field to fix: ${selection}`, [invalidSelection(selection)], function* ({ repository }) {
		const error = yield* repository.syncFailure();

		expect(error.message).toBe(`${repository.path}/package.json: "shivaedevSkills" must be a list of skill names.`);
		expect(yield* repository.exists(MANIFEST)).toBe(false);
	});
}
