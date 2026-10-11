import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

interface FollowRun {
	readonly code: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

interface Follower {
	readonly done: Promise<FollowRun>;
	readonly output: () => string;
}

interface FollowOptions {
	readonly interval?: number;
	readonly timeout?: number;
}

export function withFollower<A, E, R>(
	configFile: string,
	command: "wait" | "watch",
	ids: readonly string[],
	options: FollowOptions,
	use: (follower: Follower) => Effect.Effect<A, E, R>,
) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
			const child = spawn(
				process.execPath,
				[
					"--conditions=source",
					cli,
					command,
					...ids,
					"--config",
					configFile,
					"--interval",
					String(options.interval ?? 0.05),
					"--timeout",
					String(options.timeout ?? 20),
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
				child.on("close", (code) =>
					resolve({
						code,
						stderr: stderr.trim(),
						stdout: stdout.trim(),
					}),
				);
			});
			return { child, done, output: () => stdout };
		}),
		use,
		({ child, done }) =>
			Effect.promise(async () => {
				child.kill();
				await done;
			}),
	);
}

export const untilOutput = Effect.fn("FollowerTest.untilOutput")(function* (follower: Follower, text: string) {
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		if (follower.output().includes(text)) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
	return yield* Effect.die(new Error(`Follower did not print ${text}`));
});
