import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { skills } from "#test/skills.ts";
import { pullRequestBranch, selectsShipped } from "#test/traits.ts";

const INSTALL = "Install dependencies";
const CHECK = "Check the shared skills";
const SYNC = "Sync, commit and push the shared skills";

skills.it("the sync workflow runs on pull requests, and only for branches of the same repository", [], function* ({ workflow }) {
	yield* outcomes({
		"job condition": [workflow.jobCondition(), "github.event.pull_request.head.repo.full_name == github.repository"],
		triggers: [workflow.triggers(), ["pull_request"]],
	});
});

skills.it("the sync workflow asks for contents: write so its sync step can push", [], function* ({ workflow }) {
	expect(yield* workflow.permissions()).toEqual({ contents: "write" });
});

skills.it("the sync workflow installs dependencies from the frozen lockfile before the check and sync steps", [], function* ({ workflow }) {
	yield* outcomes({
		"install command": [workflow.stepField(INSTALL, "run"), "pnpm install --frozen-lockfile"],
		steps: [workflow.stepNames(), ["Check out the pull request branch", "Set up pnpm", "Set up Node.js", INSTALL, CHECK, SYNC]],
	});
});

skills.it("the check step may fail without failing the job, and the sync step runs only when it failed", [], function* ({ workflow }) {
	yield* outcomes({
		"check step continues on error": [workflow.stepField(CHECK, "continue-on-error"), "true"],
		"check step id": [workflow.stepField(CHECK, "id"), "check"],
		"sync step condition": [workflow.stepField(SYNC, "if"), "steps.check.outcome == 'failure'"],
	});
});

skills.it(
	"on a pull request branch that never synced its selection, the check step fails with the missing manifest",
	[selectsShipped("pr-description"), pullRequestBranch],
	function* ({ workflow }) {
		expect(yield* workflow.runs(CHECK)).toEqual({
			exit: 1,
			stderr:
				"shivaedev-skills: The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\nRun `shivaedev-skills sync` and commit the result.\n",
			stdout: "",
		});
	},
);

skills.it(
	"the sync step pushes a commit titled Sync shared skills with @shivaedev/skills to the pull request branch, carrying the copy, the manifest and the Claude link",
	[selectsShipped("pr-description"), pullRequestBranch],
	function* ({ workflow }) {
		expect(yield* workflow.pushedCommit()).toEqual({ files: [".gitignore", "package.json"], subject: "Select the shared skills" });

		yield* workflow.runs(SYNC);

		expect(yield* workflow.pushedCommit()).toEqual({
			files: [
				".agents/skills/.shivaedev-skills.json",
				".agents/skills/pr-description/SKILL.md",
				".claude/skills/pr-description",
				".gitignore",
				"package.json",
			],
			subject: "Sync shared skills with @shivaedev/skills",
		});
	},
);
