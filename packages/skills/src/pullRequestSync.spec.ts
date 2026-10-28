import { expect } from "@effect/vitest";
import { skills } from "#test/skills.ts";
import { pullRequestBranch, shippedSkills } from "#test/traits.ts";

const CHECK = "Check the shared skills";
const SYNC = "Sync, commit and push the shared skills";

skills.it("the template runs check on pull requests from branches of the same repository with write access", [], function* ({ workflow }) {
	const template = yield* workflow.template();
	expect(template).toMatch(/^on:\n {2}pull_request:\n/mu);
	expect(template).toMatch(/^permissions:\n {2}contents: write\n/mu);
	expect(template).toContain("    if: github.event.pull_request.head.repo.full_name == github.repository\n");
	expect(yield* workflow.step("Install dependencies")).toEqual({ fields: {}, run: "pnpm install --frozen-lockfile" });
	expect(yield* workflow.step(CHECK)).toEqual({ fields: { "continue-on-error": "true", id: "check" }, run: "pnpm exec shivaedev-skills check" });
	expect((yield* workflow.step(SYNC)).fields).toEqual({ if: "steps.check.outcome == 'failure'" });
});

skills.it(
	"after a failed check the template's sync step syncs, commits both agent directories and pushes to the branch",
	[shippedSkills, pullRequestBranch],
	function* ({ pullRequest, workflow }) {
		expect((yield* workflow.runs(CHECK)).status).not.toBe(0);
		expect(yield* workflow.runs(SYNC)).toMatchObject({ status: 0 });
		const pushed = pullRequest.pushedCommit();
		expect(pushed.subject).toBe("Sync shared skills with @shivaedev/skills");
		expect(pushed.files).toEqual(
			expect.arrayContaining([
				".agents/skills/.shivaedev-skills.json",
				".agents/skills/story-testing/SKILL.md",
				".claude/skills/story-testing",
				".claude/skills/pr-description",
				".claude/skills/visual-pages",
			]),
		);
		expect(pullRequest.uncommittedChanges()).toBe("");
		expect((yield* workflow.runs(CHECK)).status).toBe(0);
	},
);
