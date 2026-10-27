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
	readonly apiUrl?: string;
	readonly cwd?: string;
	readonly events?: string;
	readonly follow?: boolean;
	readonly heartbeat?: number;
	readonly interval?: number;
	readonly json?: boolean;
	readonly port?: number;
	readonly prEvents?: boolean;
	readonly prInterval?: number;
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
					...(options.cwd === undefined ? ["--board", dirname(configFile)] : []),
					...followArguments(options),
				],
				{ cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] },
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

function followArguments(options: FollowOptions) {
	const values: Readonly<Record<string, string | number | undefined>> = {
		"api-url": options.apiUrl,
		events: options.events,
		heartbeat: options.heartbeat,
		interval: options.interval ?? 0.05,
		port: options.port,
		"pr-interval": options.prInterval,
		"stuck-after": options.stuckAfter,
		timeout: options.follow && options.timeout === undefined ? undefined : (options.timeout ?? 20),
	};
	return [
		...(options.json ? ["--json"] : []),
		...(options.follow ? ["--follow"] : []),
		...(options.prEvents === undefined ? [] : ["--pr-events", String(options.prEvents)]),
		...Object.entries(values).flatMap(([flag, value]) => (value === undefined ? [] : [`--${flag}`, String(value)])),
	];
}
