import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

interface Message {
	readonly error?: string;
	readonly path?: string;
	readonly phase: string;
	readonly url?: string;
}

export function abandonedSocketStartup(root: string) {
	const lock = join(root, "board.sock.starting");
	mkdirSync(lock);
	return lock;
}

export const socketStartup = Effect.fn("Test.socketStartup")(function* (root: string, phase = "none") {
	const child = yield* Effect.acquireRelease(
		Effect.sync(() =>
			spawn(process.execPath, ["--conditions=source", fileURLToPath(new URL("./socketStartupChild.ts", import.meta.url)), root, phase], {
				stdio: ["ignore", "ignore", "pipe", "ipc"],
			}),
		),
		(running) =>
			Effect.promise(
				() =>
					new Promise<void>((resolve) => {
						if (running.exitCode !== null || running.signalCode !== null) {
							resolve();
							return;
						}
						running.once("exit", () => resolve());
						running.kill("SIGKILL");
					}),
			),
	);
	const messages: Message[] = [];
	let receive: ((message: Message) => void) | undefined;
	let failed: ((error: Error) => void) | undefined;
	let output = "";
	child.stderr?.on("data", (chunk: Buffer) => {
		output += chunk.toString("utf8");
	});
	child.on("message", (message: Message) => {
		if (receive) {
			const resolve = receive;
			receive = undefined;
			failed = undefined;
			resolve(message);
		} else {
			messages.push(message);
		}
	});
	child.on("exit", (code, signal) => failed?.(new Error(`Socket startup exited ${code ?? signal}: ${output}`)));
	child.on("error", (error) => failed?.(error));
	return {
		next: () =>
			Effect.promise(
				() =>
					new Promise<Message>((resolve, reject) => {
						const message = messages.shift();
						if (message) {
							resolve(message);
						} else if (child.exitCode !== null || child.signalCode !== null) {
							reject(new Error(`Socket startup exited: ${output}`));
						} else {
							receive = resolve;
							failed = reject;
						}
					}),
			),
		send: (message: string) => Effect.sync(() => child.send(message)),
	};
});
