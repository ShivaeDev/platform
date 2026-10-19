import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeEngine, nativeIo } from "./engine.ts";
import { github } from "./fixtures.ts";
import { processVerbs } from "./processVerbs.ts";
import { watcherVerbs } from "./watcherVerbs.ts";

export const watch = storyKit({
	clock: "live",
	create: () => makeEngine,
	inspect: (engine) => ({ diagnostics: engine.diagnostics, events: engine.lines, requests: engine.requests }),
	layer: nativeIo,
	name: "PR watcher",
	stages: ["github", "history"],
	verbs: (engine, story) => ({
		...github(engine, story.tell),
		...watcherVerbs(engine, story.tell),
		...processVerbs(engine, story.tell),
	}),
});
