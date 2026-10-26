import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import type { WatchError } from "#model.ts";
import { program } from "#program.ts";
import { cliVerbs } from "#test/cliVerbs.ts";
import type { Engine } from "#test/engine.ts";
import { processClock } from "#test/processClock.ts";
export function processVerbs(engine: Engine, tell: (line: string) => void) {
	let running: Fiber.Fiber<void, WatchError> | undefined;
	let observed: ReturnType<typeof processClock> | undefined;
	function args() {
		return ["--repo", engine.options.repository, "--state", engine.options.stateFile, "--api-url", engine.options.apiUrl];
	}
	const until = Effect.fnUntraced(function* (description: string, predicate: () => boolean) {
		tell(`wait for ${description}`);
		for (let attempt = 0; attempt < 400 && !predicate(); attempt += 1) {
			yield* Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
		}
		if (!predicate()) {
			throw new Error(`Timed out waiting for ${description}`);
		}
	});
	return {
		...cliVerbs(engine, tell, until),
		advance: (milliseconds: number) => {
			tell(`the clock advances ${milliseconds} milliseconds`);
			return TestClock.adjust(milliseconds);
		},
		cliRun: (...extra: string[]) =>
			Effect.promise(() => {
				tell(`the CLI runs ${extra.join(" ")}`);
				return new Promise<{
					code: string | number;
					stderr: string;
					stdout: string;
				}>((done) => {
					execFile(
						process.execPath,
						["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), ...args(), ...extra],
						{ timeout: 5000 },
						(error, stdout, stderr) => done({ code: error?.code ?? 0, stderr, stdout }),
					);
				});
			}),
		elapse: (milliseconds: number) =>
			Effect.gen(function* () {
				tell(`${milliseconds} milliseconds pass`);
				yield* Effect.sleep(milliseconds);
			}),
		finish: () =>
			Effect.gen(function* () {
				if (running === undefined) {
					throw new Error("Start the watcher before joining it");
				}
				return yield* Fiber.await(running);
			}),
		help: () => program(["--help"], engine.emit, engine.diagnostic).pipe(Effect.provide(engine.context)),
		interrupt: () =>
			Effect.gen(function* () {
				tell("the continuous watcher is interrupted");
				if (running === undefined) {
					throw new Error("Start the watcher before interrupting it");
				}
				yield* Fiber.interrupt(running);
			}),
		once: (...extra: string[]) => program([...args(), "1", "--once", ...extra], engine.emit, engine.diagnostic).pipe(Effect.provide(engine.context)),
		requestsAfterPause: () =>
			Effect.gen(function* () {
				yield* Effect.sleep("50 millis");
				return [...engine.requests];
			}),
		start: (...extra: string[]) =>
			Effect.gen(function* () {
				tell("the continuous fleet watcher starts");
				observed = processClock(yield* Clock.Clock, (id) => id === running?.id);
				running = yield* Effect.forkChild(
					program([...args(), "--fleet", "--interval", "1", ...extra], engine.emit, engine.diagnostic).pipe(
						Effect.provide(engine.context),
						Effect.provideService(Clock.Clock, observed.clock),
					),
				);
			}),
		waitForEvents: (count: number) =>
			until(`${count} emitted PR event lines`, () => engine.lines.filter((line) => JSON.parse(line).number !== undefined).length >= count),
		waitForPollWait: () => until("the watcher to sleep before its next poll", () => observed?.waiting() === true),
		waitForRequest: (suffix: string) =>
			until(`a request ending in ${suffix}`, () => engine.requests.some((request) => request.path.endsWith(suffix))),
		waitForTransport: () => until("a pending HTTP request", () => engine.io.control.transportPending),
	};
}
