import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { scriptProcess } from "./scriptProcess.ts";

interface Engine {
	greeting: string | undefined;
	process: Effect.Success<ReturnType<typeof scriptProcess>> | undefined;
}

export const scripts = storyKit({
	create() {
		const engine: Engine = { greeting: "Hello", process: undefined };
		return engine;
	},
	name: "defined script process",
	stages: ["configuration"],
	verbs: (engine, story) => {
		function running() {
			if (engine.process === undefined) {
				throw new Error("Start the script before observing it");
			}
			return engine.process;
		}
		return {
			finished: () => Effect.suspend(() => running().finished()),
			interrupt: () => {
				story.tell("the script receives Ctrl-C");
				return Effect.suspend(() => running().interrupt());
			},
			start: (...args: readonly string[]) =>
				Effect.gen(function* () {
					story.tell(`the defined script starts with ${args.join(" ")}`);
					engine.process = yield* scriptProcess(engine.greeting);
					yield* engine.process.start(args);
				}),
			waiting: () => Effect.suspend(() => running().waiting()),
		};
	},
});

export const missingGreeting = scripts.trait("configuration", "SCRIPT_GREETING is absent from the environment", (engine) => {
	engine.greeting = undefined;
});
