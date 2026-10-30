import { expect } from "@effect/vitest";
import { skills } from "#test/skills.ts";
import { selectsShipped, synced } from "#test/traits.ts";

const SHIPPED = ["pr-description", "story-testing", "visual-pages"] as const;

skills.it(
	"before the first sync, the check command exits 1 and prints the missing manifest and the sync to run",
	[selectsShipped(...SHIPPED)],
	function* ({ cli }) {
		expect(yield* cli.check()).toEqual({
			exit: 1,
			stderr:
				"shivaedev-skills: The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\nRun `shivaedev-skills sync` and commit the result.\n",
			stdout: "",
		});
	},
);

skills.it(
	"the sync command exits 0 and prints the shipped skills it synced and the package version",
	[selectsShipped(...SHIPPED)],
	function* ({ cli, installedVersion }) {
		expect(yield* cli.sync()).toEqual({
			exit: 0,
			stderr: "",
			stdout: `Synced pr-description, story-testing, visual-pages from @shivaedev/skills ${installedVersion()}.\n`,
		});
	},
);

skills.it(
	"the sync command syncs the shipped skills into both agent directories of the repository it runs in",
	[selectsShipped(...SHIPPED)],
	function* ({ cli, skillFolders }) {
		yield* cli.sync();

		expect(yield* skillFolders()).toEqual({ ".agents/skills": SHIPPED, ".claude/skills": SHIPPED });
	},
);

skills.it(
	"after a sync, the check command exits 0 and prints the matching package version",
	[selectsShipped(...SHIPPED), synced],
	function* ({ cli, installedVersion }) {
		expect(yield* cli.check()).toEqual({ exit: 0, stderr: "", stdout: `The shared skills match @shivaedev/skills ${installedVersion()}.\n` });
	},
);
