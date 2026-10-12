import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { requireThat } from "#package-check/io.ts";

export const runStarter = Effect.fn("Published.runStarter")(function* (cwd: string, database: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	for (const args of [
		["run", "typecheck"],
		["run", "build"],
		["test", "src/server/starterHost.test.ts", "src/server/committedJobs.spec.ts"],
	]) {
		yield* Effect.log(`Copied starter: pnpm ${args.join(" ")}`);
		const code = yield* spawner.exitCode(
			ChildProcess.make("pnpm", args, {
				cwd,
				env: { "PLATFORM_EFFECT_SQL_TEST_DATABASE_URL": database, "TEST_DATABASE_URL": database },
				extendEnv: true,
				stderr: "inherit",
				stdout: "inherit",
			}),
		);
		yield* requireThat(code === 0, `Copied starter: pnpm ${args.join(" ")} failed (exit ${code}).`);
	}
});
