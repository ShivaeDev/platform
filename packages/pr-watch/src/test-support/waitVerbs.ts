import { Clock, Effect, type Exit, Layer, Runtime } from "effect";
import { type Engine, waitArguments } from "#test/engine.ts";
import { clockTime, request } from "#test/readouts.ts";
import { waitProgram } from "#waitCommand.ts";
import type { WaitResult } from "#waitResult.ts";

export function waitVerbs(engine: Engine, tell: (line: string) => void) {
	const { process } = engine;
	const settled = process.settledUnless(() => engine.io.control.stalled > 0);
	function print(result: WaitResult) {
		return Effect.sync(() => {
			engine.wait.printed.push(result);
		});
	}
	function progress(line: string) {
		return Clock.currentTimeMillis.pipe(
			Effect.flatMap((at) =>
				Effect.sync(() => {
					engine.wait.progress.push(`${clockTime(at)} ${line}`);
				}),
			),
		);
	}
	function recordExit(exit: Exit.Exit<unknown, unknown>) {
		return Effect.sync(() =>
			Runtime.defaultTeardown(exit, (code) => {
				engine.wait.exit = code;
			}),
		);
	}
	return {
		progressLines: () => Effect.sync(() => [...engine.wait.progress]),
		requestLog: () => Effect.sync(() => engine.github.requests.map((received) => `${clockTime(received.at)} ${request(received)}`)),
		startWait: (number: number, ...extra: string[]) =>
			Effect.gen(function* () {
				tell(`a wait for PR ${number} starts${extra.length === 0 ? "" : ` with ${extra.join(" ")}`}`);
				engine.wait = { printed: [], progress: [] };
				engine.context = yield* Layer.build(Layer.fresh(engine.layer));
				process.state.finished = false;
				const run = waitProgram(waitArguments(engine, number, extra), print, progress).pipe(
					Effect.provide(engine.context),
					Effect.onExit(recordExit),
					Effect.ignore,
				);
				process.state.fiber = yield* Effect.forkChild(
					process.identify(run).pipe(Effect.provideService(Clock.Clock, process.clock), Effect.ensuring(Effect.sync(process.finished))),
				);
				yield* settled;
			}),
		waitExit: () => Effect.sync(() => (engine.wait.exit === undefined ? "still waiting" : `exit code ${engine.wait.exit}`)),
		waitPrinted: () => Effect.sync(() => [...engine.wait.printed]),
	};
}
