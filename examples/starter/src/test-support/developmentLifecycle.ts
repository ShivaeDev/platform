import { fileURLToPath } from "node:url";
import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { developmentServer } from "./developmentServer.ts";

export const developmentLifecycle = storyKit({
	clock: "live",
	*create() {
		const stderr: string[] = [];
		const stdout: string[] = [];
		return { blocked: yield* Deferred.make<void>(), stderr, stdout };
	},
	name: "development lifecycle",
	stages: [],
	verbs: (engine, story) => ({
		optimizerBlocked: Deferred.await(engine.blocked),
		output: () => ({ stderr: [...engine.stderr], stdout: [...engine.stdout] }),
		startDevelopment: () => {
			story.tell("start Vite with a blocked dependency optimizer");
			return developmentServer("http://127.0.0.1:3000", {
				configFile: fileURLToPath(new URL("./blockedOptimizer.config.ts", import.meta.url)),
				onOutput: (source, line) => {
					engine[source].push(line);
					if (line === "dependency optimizer blocked") {
						Effect.runSync(Deferred.succeed(engine.blocked, undefined));
					}
				},
			});
		},
	}),
});
