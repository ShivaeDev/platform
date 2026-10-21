import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { verbs } from "./verbs.ts";
import { workspace } from "./workspace.ts";

export const planning = storyKit({
	clock: "live",
	create: workspace,
	inspect: (engine) => ({ jobs: engine.jobs, root: engine.workspace.root }),
	name: "CI planning",
	stages: ["workspace"],
	verbs,
});
