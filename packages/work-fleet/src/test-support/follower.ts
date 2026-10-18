import { spawn } from "node:child_process";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { loadHost } from "#host/configFile.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

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

interface FollowOptions {
	readonly discover?: boolean;
	readonly follow?: boolean;
	readonly interval?: number;
	readonly port?: number;
	readonly timeout?: number;
}

export function withFollower<A, E, R>(
	configFile: string,
	command: "wait" | "watch",
	ids: readonly string[],
	options: FollowOptions,
	use: (follower: Follower) => Effect.Effect<A, E, R>,
) {
	const ready = Promise.withResolvers<void>();
	function run(port: number) {
		const portArgs = options.port === undefined || options.discover ? [] : ["--port", String(port)];
		return Effect.acquireUseRelease(
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
						"--board",
						dirname(configFile),
						...portArgs,
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
					ready: options.port === undefined ? ready.promise : Promise.resolve(),
				};
			}),
			use,
			({ child, done }) =>
				Effect.promise(async () => {
					child.kill();
					await done;
				}),
		);
	}
	return options.port === undefined
		? loadHost(dirname(configFile), configFile).pipe(
				Effect.flatMap((host) => withReadDaemon(host, run, { onSnapshot: () => ready.resolve() })),
				Effect.provide(NodeServices.layer),
			)
		: run(options.port);
}

export const untilOutput = Effect.fn("FollowerTest.untilOutput")(function* (follower: Follower, text: string) {
	yield* untilText(follower.output, text);
});

export const untilError = Effect.fn("FollowerTest.untilError")(function* (follower: Follower, text: string) {
	yield* untilText(follower.errors, text);
});

const untilText = Effect.fn("FollowerTest.untilText")(function* (output: () => string, text: string) {
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		if (output().includes(text)) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
	return yield* Effect.die(new Error(`Follower did not print ${text}; got ${output()}`));
});

export function untilEveryOutput(followers: readonly Follower[], text: string) {
	return Effect.forEach(followers, (follower) => untilOutput(follower, text), { discard: true });
}
