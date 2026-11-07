import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { verbs } from "#ci/test-support/verbs.ts";
import { workspace } from "#ci/test-support/workspace.ts";

export const planning = storyKit({
	create: workspace,
	inspect: (engine) => ({ jobs: engine.jobs, root: engine.workspace.root }),
	name: "CI planning",
	stages: ["workspace"],
	verbs,
});
