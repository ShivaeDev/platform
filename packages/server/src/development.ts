import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export interface DevelopmentOptions {
	readonly conditions?: readonly string[];
	readonly server: string;
	readonly worker: string;
}

export const development = Effect.fn("Platform.development")(function* ({ server, worker, conditions = [] }: DevelopmentOptions) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const options = { stderr: "inherit", stdout: "inherit" } as const;
	const args = [...conditions.map((condition) => `--conditions=${condition}`), "--watch"];
	return yield* Effect.raceAll([
		spawner.exitCode(ChildProcess.make(process.execPath, [...args, server], options)),
		spawner.exitCode(ChildProcess.make(process.execPath, [...args, worker], options)),
		spawner.exitCode(ChildProcess.make("pnpm", ["exec", "vite"], options)),
	]);
});

export function runDevelopment(options: DevelopmentOptions): void {
	NodeRuntime.runMain(
		development(options).pipe(
			Effect.tap((code) =>
				Effect.sync(() => {
					process.exitCode = code;
				}),
			),
			Effect.provide(NodeServices.layer),
		),
	);
}
