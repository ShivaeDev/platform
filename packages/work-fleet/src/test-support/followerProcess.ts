import { spawn } from "node:child_process";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

interface FollowRun {
	readonly code: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

export interface Follower {
	readonly done: Promise<FollowRun>;
	readonly errors: () => string;
	readonly isRunning: () => boolean;
	readonly output: () => string;
	readonly ready: Promise<void>;
}

export interface FollowOptions {
	readonly events?: string;
	readonly follow?: boolean;
	readonly interval?: number;
	readonly port?: number;
	readonly stuckAfter?: number;
	readonly timeout?: number;
}

export function followerProcess(
	configFile: string,
	command: "wait" | "watch",
	ids: readonly string[],
	options: FollowOptions,
	ready: Promise<void> = Promise.resolve(),
) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
			const child = spawn(
				process.execPath,
				[
					"--conditions=source",
					"--import",
					fileURLToPath(new URL("./clientDatabaseGuard.ts", import.meta.url)),
					cli,
					command,
					...ids,
					...(options.follow ? ["--follow"] : []),
					...(options.events === undefined ? [] : ["--events", options.events]),
					...(options.stuckAfter === undefined ? [] : ["--stuck-after", String(options.stuckAfter)]),
					"--board",
					dirname(configFile),
					...(options.port === undefined ? [] : ["--port", String(options.port)]),
					"--interval",
					String(options.interval ?? 0.05),
					...(options.follow && options.timeout === undefined ? [] : ["--timeout", String(options.timeout ?? 20)]),
				],
				{ stdio: ["ignore", "pipe", "pipe"] },
			);
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk: Buffer) => {
				stdout += chunk.toString();
			});
			child.stderr.on("data", (chunk: Buffer) => {
				stderr += chunk.toString();
			});
			const done = new Promise<FollowRun>((resolve, reject) => {
				child.on("error", reject);
				function finish(code: number | null) {
					if (code === 97) {
						reject(new Error("Fleet client attempted a direct PostgreSQL connection"));
					} else {
						resolve({ code, stderr: stderr.trim(), stdout: stdout.trim() });
					}
				}
				child.on("close", finish);
			});
			return {
				child,
				done,
				errors: () => stderr,
				isRunning: () => child.exitCode === null && child.signalCode === null,
				output: () => stdout,
				ready,
			};
		}),
		({ child, done }) =>
			Effect.promise(async () => {
				child.kill();
				await done;
			}),
	);
}
