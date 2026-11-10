import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cliVerbs } from "#test/cliVerbs.ts";
import { makeEngine, nativeIo } from "#test/engine.ts";
import { githubVerbs } from "#test/githubVerbs.ts";
import { processVerbs } from "#test/processVerbs.ts";
import { roundVerbs } from "#test/roundVerbs.ts";
import { waitVerbs } from "#test/waitVerbs.ts";
import { watcherVerbs } from "#test/watcherVerbs.ts";

export const watch = storyKit({
	clock: "test",
	create: () => makeEngine,
	inspect: (engine) => ({
		cli: engine.cli,
		diagnostics: engine.diagnostics,
		printed: engine.lines,
		requests: engine.github.requests,
		wait: engine.wait,
	}),
	layer: nativeIo,
	name: "PR watcher",
	stages: ["github", "settings", "history"],
	verbs: (engine, story) => ({
		...githubVerbs(engine, story.tell),
		...watcherVerbs(engine, story.tell),
		...roundVerbs(engine, story.tell),
		...processVerbs(engine, story.tell),
		...cliVerbs(engine, story.tell),
		...waitVerbs(engine, story.tell),
	}),
});
