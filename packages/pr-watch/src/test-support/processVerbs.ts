import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, Fiber } from "effect";
import type { WatchError } from "#model.ts";
import { program } from "#program.ts";
import type { Engine } from "./engine.ts";
export function processVerbs(engine: Engine, tell: (line: string) => void) {
	let running: Fiber.Fiber<void, WatchError> | undefined;
	function args() {
		return ["--repo", engine.options.repository, "--state", engine.options.stateFile, "--api-url", engine.options.apiUrl];
	}
	const until = Effect.fnUntraced(function* (description: string, predicate: () => boolean) {
		tell(`wait for ${description}`);
		for (let attempt = 0; attempt < 400 && !predicate(); attempt += 1) {
			yield* Effect.sleep("10 millis");
		}
		if (!predicate()) {
			throw new Error(`Timed out waiting for ${description}`);
		}
	});
	return {
		cliOnce: (...numbers: number[]) =>
			Effect.promise(() => {
				tell(`the CLI observes PRs ${numbers.join(", ")} once`);
				return new Promise<{
					code: string | number;
					stderr: string;
					stdout: string;
				}>((done) => {
					execFile(
						process.execPath,
						["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), ...args(), ...numbers.map(String), "--once"],
						{ timeout: 5000 },
						(error, stdout, stderr) => done({ code: error?.code ?? 0, stderr, stdout }),
					);
				});
			}),
		help: () => program(["--help"], "", engine.emit, engine.diagnostic).pipe(Effect.provide(engine.context)),
		interrupt: () =>
			Effect.gen(function* () {
				tell("the continuous watcher is interrupted");
				if (running === undefined) {
					throw new Error("Start the watcher before interrupting it");
				}
				yield* Fiber.interrupt(running);
			}),
		once: () => program([...args(), "1", "--once"], "token", engine.emit, engine.diagnostic).pipe(Effect.provide(engine.context)),
		requestsAfterPause: () =>
			Effect.gen(function* () {
				yield* Effect.sleep("50 millis");
				return [...engine.requests];
			}),
		start: () =>
			Effect.gen(function* () {
				tell("the continuous fleet watcher starts");
				running = yield* Effect.forkChild(
					program([...args(), "--fleet", "--interval", "1"], "token", engine.emit, engine.diagnostic).pipe(Effect.provide(engine.context)),
				);
			}),
		waitForDiagnostic: () => until("a diagnostic", () => engine.diagnostics.length > 0),
		waitForEvents: (count: number) => until(`${count} emitted event lines`, () => engine.lines.length === count),
		waitForRequest: (suffix: string) =>
			until(`a request ending in ${suffix}`, () => engine.requests.some((request) => request.path.endsWith(suffix))),
	};
}
