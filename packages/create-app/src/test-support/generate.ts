import { Effect } from "effect";
import { cliAnswer } from "./answers.ts";
import { runCli } from "./cli.ts";
import { commandTiming } from "./commandTiming.ts";
import type { createEngine } from "./createEngine.ts";

export type Engine = ReturnType<typeof createEngine> extends Generator<unknown, infer TEngine, never> ? TEngine : never;

export const createAppIn = Effect.fn("CreateAppStory.createAppIn")(function* (engine: Engine, args: readonly string[]) {
	const started = performance.now();
	if (!(engine.packed || args.includes("--help") || args.includes("--version"))) {
		yield* engine.source.pack();
		engine.packed = true;
	}
	if (args[0] !== undefined && !args[0].startsWith("--")) {
		engine.app = args[0];
	}
	const result = yield* runCli(engine.root, engine.cli, engine.options.gitAvailable ?? true, args, engine.environment);
	commandTiming(`create-app ${args.join(" ")}`, started, result.stderr);
	engine.diagnostics = result.stderr;
	engine.printed = result.stdout;
	const answer = cliAnswer(result, engine.root, () => "created");
	engine.answers.push(answer);
	return answer;
});

export const generateApp = Effect.fn("CreateAppStory.generateApp")(function* (engine: Engine, args: readonly string[]) {
	const answer = yield* createAppIn(engine, args);
	if (answer !== "created") {
		return yield* Effect.die(new Error(`create-app ${args.join(" ")} did not create the app: ${answer}`));
	}
});
