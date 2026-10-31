import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { type Folder, folder } from "#test/board.ts";

interface Message {
	readonly error?: string;
	readonly path?: string;
	readonly phase: string;
	readonly url?: string;
}

export function abandonedSocketStartup(root: string) {
	const lock = join(root, ".board.sock.starting");
	mkdirSync(lock);
	return lock;
}

export function nestedSocketFolder(): Folder {
	const parent = folder({});
	const nested = "notes-".padEnd(83 - Buffer.byteLength(parent.root) - 1, "x");
	parent.write(`${nested}/note.md`, "# Notes\n");
	return {
		remove: parent.remove,
		root: join(parent.root, nested),
		write: (path, content) => parent.write(`${nested}/${path}`, content),
	};
}

export const socketStartup = Effect.fn("Test.socketStartup")(function* (
	root: string,
	phase = "none",
	entry = new URL("./socketStartupChild.ts", import.meta.url),
) {
	const child = yield* Effect.acquireRelease(
		Effect.sync(() =>
			spawn(process.execPath, ["--conditions=source", fileURLToPath(entry), root, phase], {
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
		kill: Effect.promise(
			() =>
				new Promise<void>((resolve) => {
					child.once("exit", () => resolve());
					child.kill("SIGKILL");
				}),
		),
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
