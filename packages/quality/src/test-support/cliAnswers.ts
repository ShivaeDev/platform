import { Effect } from "effect";
import { quality, type Run, runQuality } from "./cli.ts";

export type CliOutcome = "passed" | "rejected" | "invalid" | `exited ${string}`;

const OUTCOMES: ReadonlyMap<number | null, CliOutcome> = new Map([
	[0, "passed"],
	[1, "rejected"],
	[2, "invalid"],
]);

export interface CliAnswer {
	readonly outcome: CliOutcome;
	readonly stderr: string;
	readonly stdout: string;
}

export interface CliEngine {
	answer: CliAnswer | undefined;
	readonly root: string;
}

export function answerOf(run: Run): CliAnswer {
	return { outcome: OUTCOMES.get(run.status) ?? `exited ${String(run.status)}`, stderr: run.stderr, stdout: run.stdout };
}

function answered(engine: CliEngine): CliAnswer {
	if (engine.answer === undefined) {
		throw new Error("Run quality before reading its answer");
	}
	return engine.answer;
}

function recorded(engine: CliEngine, run: Run): CliAnswer {
	engine.answer = answerOf(run);
	return engine.answer;
}

export function cliVerbs(engine: CliEngine, tell: (line: string) => void) {
	return {
		outcome: () => Effect.sync(() => answered(engine).outcome),
		runs: (...args: readonly string[]) =>
			Effect.promise(async () => {
				tell(`the author runs quality ${args.join(" ")}`);
				return recorded(engine, await runQuality(engine.root, ...args));
			}),
		spawns: (...args: readonly string[]) =>
			Effect.sync(() => {
				tell(`the author starts the quality executable with ${args.length === 0 ? "no arguments" : args.join(" ")}`);
				return recorded(engine, quality(engine.root, ...args));
			}),
		stderr: () => Effect.sync(() => answered(engine).stderr),
		stdout: () => Effect.sync(() => answered(engine).stdout),
	};
}
