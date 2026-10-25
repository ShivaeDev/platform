import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { attachServer } from "./servingEngine.ts";
import type { BoardEngine } from "./storyEngine.ts";

export const boardCommand = Effect.fn("Story.boardCommand")(function* (engine: BoardEngine, args: readonly string[], tell: (line: string) => void) {
	tell("the reader launches work-board for the project");
	const child = spawn(
		process.execPath,
		[
			"--conditions=source",
			engine.cliEntry ?? fileURLToPath(new URL("../server/cli.ts", import.meta.url)),
			engine.notes.root,
			"--port",
			"0",
			...args,
		],
		{ stdio: ["ignore", "pipe", "pipe"] },
	);
	let output = "";
	const address = Promise.withResolvers<string>();
	const finished = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
	function collect(chunk: Buffer) {
		output += chunk.toString("utf8");
		const url = /Listening on (?<address>http:\/\/\S+)/u.exec(output)?.groups?.address;
		if (url) {
			address.resolve(url);
		}
	}
	child.stdout.on("data", collect);
	child.stderr.on("data", collect);
	child.on("error", (error) => {
		address.reject(error);
		finished.reject(error);
	});
	child.on("exit", (code, signal) => {
		finished.resolve({ code, signal });
		address.reject(new Error(`work-board exited ${code ?? signal}:\n${output}`));
	});
	void address.promise.catch(() => undefined);
	function stop() {
		return Effect.promise(async () => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill();
			}
			await finished.promise;
		});
	}
	yield* Effect.addFinalizer(stop);
	return {
		exit: () => {
			tell("the reader waits for the command to exit");
			return Effect.promise(() => finished.promise);
		},
		listening: Effect.fn("Story.listening")(function* () {
			tell("the reader observes the command's listening address");
			const url = yield* Effect.promise(() => address.promise);
			const parsed = new URL(url);
			yield* attachServer(engine, { hostname: parsed.hostname, port: Number(parsed.port), stop, url });
			return url;
		}),
		output: () => {
			tell("the reader reads the command's output");
			return output;
		},
		signal: (signal: NodeJS.Signals) => {
			tell(`the reader sends ${signal} to the command`);
			if (!child.kill(signal)) {
				throw new Error("The command did not receive its signal");
			}
		},
	};
});
