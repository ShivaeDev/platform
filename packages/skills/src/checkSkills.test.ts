import { expect } from "@effect/vitest";
import { RUN_SYNC, skills } from "#test/skills.ts";
import { addedCopyFile, deletedBeta, editedCopy, removedNotes, selected, selectionChangedTo, synced, versionBumped } from "#test/traits.ts";

skills.it("passes once the selection is synced", [selected("alpha", "beta")], function* ({ repository }) {
	yield* repository.sync();
	yield* repository.check();
});

skills.it("fails until sync records the installed version after a bump", [selected("alpha"), synced, versionBumped], function* ({ repository }) {
	const error = yield* repository.checkFailure();

	expect(error.message).toBe(
		`The shared skills are out of sync:\n- The skills were synced from @shivaedev/skills 1.2.0, but 1.3.0 is installed.\n${RUN_SYNC}`,
	);
	yield* repository.sync();
	yield* repository.check();
});

for (const [change, trait] of [
	["edited", editedCopy("alpha")],
	["added", addedCopyFile("alpha")],
	["removed", removedNotes],
] as const) {
	skills.it(`fails when a file of a synced copy is ${change} by hand`, [selected("alpha"), synced, trait], function* ({ repository }) {
		const error = yield* repository.checkFailure();

		expect(error.message).toContain(
			"- .agents/skills/alpha differs from what shivaedev-skills synced. Shared skills change in @shivaedev/skills, not in the copy.",
		);
		expect(error.message).toContain(RUN_SYNC);
	});
}

skills.it("fails when a synced copy is deleted", [selected("alpha", "beta"), synced, deletedBeta], function* ({ repository }) {
	const error = yield* repository.checkFailure();

	expect(error.message).toBe(`The shared skills are out of sync:\n- .agents/skills/beta is missing.\n${RUN_SYNC}`);
});

skills.it("fails when the selection and the manifest disagree", [selected("alpha"), synced, selectionChangedTo("beta")], function* ({ repository }) {
	const error = yield* repository.checkFailure();

	expect(error.message).toContain('- beta is selected in "shivaedevSkills" but not synced.');
	expect(error.message).toContain('- alpha is synced but no longer selected in "shivaedevSkills".');
	expect(error.message).toContain(RUN_SYNC);
});

skills.it("fails when nothing was synced yet", [selected("alpha")], function* ({ repository }) {
	const error = yield* repository.checkFailure();

	expect(error.message).toBe(`The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\n${RUN_SYNC}`);
});
