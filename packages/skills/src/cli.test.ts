import { expect } from "@effect/vitest";
import { RUN_SYNC, skills } from "#test/skills.ts";
import { shippedSkills } from "#test/traits.ts";

skills.it("check asks for sync until sync copies the shipped skills", [shippedSkills], function* ({ cli, repository }) {
	const before = yield* cli.check();

	expect(before.status).toBe(1);
	expect(before.stderr).toContain("shivaedev-skills: The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\n");
	expect(before.stderr).toContain(RUN_SYNC);
	expect(yield* cli.sync()).toMatchObject({ status: 0, stdout: `Synced pr-description from @shivaedev/skills ${repository.version()}.\n` });
	expect(yield* repository.read(".claude/skills/pr-description/SKILL.md")).toContain("name: pr-description");
	expect(yield* cli.check()).toMatchObject({ status: 0, stdout: `The shared skills match @shivaedev/skills ${repository.version()}.\n` });
});
