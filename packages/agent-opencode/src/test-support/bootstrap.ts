import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { opencode } from "#opencode.ts";

export const bootstrap = storyKit({
	create: () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({ prefix: "opencode-startup-" });
			return { missingCommand: `${directory}/opencode` };
		}),
	layer: NodeServices.layer,
	name: "OpenCode startup",
	stages: ["runtime"],
	verbs: (engine, story) => ({
		startWithoutExecutable: () => {
			story.tell("the application starts OpenCode before installing its executable");
			return Layer.build(opencode({ command: engine.missingCommand, cwd: "/tmp" })).pipe(
				Effect.as({ outcome: "started" }),
				Effect.catchTag("BackendUnavailable", (error) => Effect.succeed({ backend: error.backend, outcome: "backend unavailable" })),
			);
		},
	}),
});
