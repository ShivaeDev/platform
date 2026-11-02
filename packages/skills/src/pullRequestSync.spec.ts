import { expect } from "@effect/vitest";
import { skills } from "#test/skills.ts";
import { pullRequestBranch, selectsShipped } from "#test/traits.ts";

const CHECK = "Check the shared skills";
const SYNC = "Sync, commit and push the shared skills";

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
