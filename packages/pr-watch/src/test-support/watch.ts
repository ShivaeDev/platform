import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cliVerbs } from "./cliVerbs.ts";
import { makeEngine, nativeIo } from "./engine.ts";
import { githubVerbs } from "./githubVerbs.ts";
import { processVerbs } from "./processVerbs.ts";
import { watcherVerbs } from "./watcherVerbs.ts";

export const watch = storyKit({
	clock: "test",
	create: () => makeEngine,
	inspect: (engine) => ({ cli: engine.cli, diagnostics: engine.diagnostics, printed: engine.lines, requests: engine.github.requests }),
	layer: nativeIo,
	name: "PR watcher",
	stages: ["github", "settings", "history"],
	verbs: (engine, story) => ({
		...githubVerbs(engine, story.tell),
		...watcherVerbs(engine, story.tell),
		...processVerbs(engine, story.tell),
		...cliVerbs(engine, story.tell),
	}),
});
