import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { checkSkills } from "#checkSkills.ts";
import { syncSkills } from "#syncSkills.ts";
import { it, removeFile, removeFixtures, select, writeFile } from "#test/fixture.ts";

afterEach(removeFixtures);

const RUN_SYNC = "Run `shivaedev-skills sync` and commit the result.";

it("passes once the selection is synced", function* ({ installed, repo }) {
	yield* select(repo, ["alpha", "beta"]);
	yield* syncSkills(repo, installed);

	yield* checkSkills(repo, installed);
});

it("fails until sync records the installed version after a bump", function* ({ installed, repo }) {
	yield* select(repo, ["alpha"]);
	yield* syncSkills(repo, installed);
	const bumped = { ...installed, version: "1.3.0" };

	const error = yield* Effect.flip(checkSkills(repo, bumped));

	expect(error.message).toBe(
		`The shared skills are out of sync:\n- The skills were synced from @shivaedev/skills 1.2.0, but 1.3.0 is installed.\n${RUN_SYNC}`,
	);
	yield* syncSkills(repo, bumped);
	yield* checkSkills(repo, bumped);
});

it.each([
	["edited", writeFile(".agents/skills/alpha/SKILL.md", "# Edited by hand\n")],
	["added", writeFile(".agents/skills/alpha/references/more.md", "# Added by hand\n")],
	["removed", removeFile(".agents/skills/alpha/references/notes.md")],
] as const)("fails when a file of a synced copy is %s by hand", function* ([, change], { installed, repo }) {
	yield* select(repo, ["alpha"]);
	yield* syncSkills(repo, installed);
	yield* change(repo);

	const error = yield* Effect.flip(checkSkills(repo, installed));

	expect(error.message).toContain(
		"- .agents/skills/alpha differs from what shivaedev-skills synced. Shared skills change in @shivaedev/skills, not in the copy.",
	);
	expect(error.message).toContain(RUN_SYNC);
});

it("fails when a synced copy is deleted", function* ({ installed, repo }) {
	yield* select(repo, ["alpha", "beta"]);
	yield* syncSkills(repo, installed);
	yield* removeFile(".agents/skills/beta")(repo);

	const error = yield* Effect.flip(checkSkills(repo, installed));

	expect(error.message).toBe(`The shared skills are out of sync:\n- .agents/skills/beta is missing.\n${RUN_SYNC}`);
});

it("fails when the selection and the manifest disagree", function* ({ installed, repo }) {
	yield* select(repo, ["alpha"]);
	yield* syncSkills(repo, installed);
	yield* select(repo, ["beta"]);

	const error = yield* Effect.flip(checkSkills(repo, installed));

	expect(error.message).toContain('- beta is selected in "shivaedevSkills" but not synced.');
	expect(error.message).toContain('- alpha is synced but no longer selected in "shivaedevSkills".');
	expect(error.message).toContain(RUN_SYNC);
});

it("fails when nothing was synced yet", function* ({ installed, repo }) {
	yield* select(repo, ["alpha"]);

	const error = yield* Effect.flip(checkSkills(repo, installed));

	expect(error.message).toBe(`The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\n${RUN_SYNC}`);
});
