import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import type { Engine } from "#test/engine.ts";

export function cliVerbs(
	engine: Engine,
	tell: (line: string) => void,
	until: (description: string, predicate: () => boolean) => Effect.Effect<void>,
) {
	let output = "";
	let errors = "";
	let result: Promise<number | null> | undefined;
	let stop: (() => void) | undefined;
	function launch(extra: readonly string[]) {
		return spawn(
			process.execPath,
			[
				"--conditions=source",
				fileURLToPath(new URL("../cli.ts", import.meta.url)),
				"--repo",
				engine.options.repository,
				"--state",
				engine.options.stateFile,
				"--api-url",
				engine.options.apiUrl,
				"--fleet",
				"--interval",
				"1",
				...extra,
			],
			{ env: engine.cliEnvironment, stdio: ["ignore", "pipe", "pipe"] },
		);
	}
	return {
		cliFinish: () =>
			Effect.promise(() => {
				if (result === undefined) {
					throw new Error("Start the CLI before joining it");
				}
				return result;
			}),
		cliLines: () =>
			output
				.split("\n")
				.slice(0, -1)
				.map((line) => JSON.parse(line)),
		cliStart: (...extra: string[]) =>
			Effect.gen(function* () {
				tell("start the CLI with stdout connected to a pipe");
				yield* Effect.acquireRelease(
					Effect.sync(() => {
						const running = launch(extra);
						running.stdout.on("data", (chunk) => {
							output += chunk.toString();
						});
						running.stderr.on("data", (chunk) => {
							errors += chunk.toString();
						});
						result = new Promise((resolve, reject) => {
							running.once("close", resolve);
							running.once("error", reject);
						});
						stop = () => {
							running.kill("SIGTERM");
						};
						return running;
					}),
					(running) =>
						Effect.promise(async () => {
							running.kill("SIGTERM");
							await result;
						}),
				);
			}),
		cliStderr: () => errors,
		cliStop: () =>
			Effect.sync(() => {
				if (stop === undefined) {
					throw new Error("Start the CLI before stopping it");
				}
				stop();
			}),
		cliWaitFor: (kind: string, count = 1) =>
			until(
				`piped CLI ${kind}`,
				() =>
					output
						.split("\n")
						.slice(0, -1)
						.filter((line) => line !== "" && JSON.parse(line).event === kind).length >= count,
			),
	};
}
