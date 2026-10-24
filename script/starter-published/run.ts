import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { requireThat } from "#package-check/io.ts";

export const runStarter = Effect.fn("Published.runStarter")(function* (cwd: string, database: string, script: "ci" | "ready" = "ci") {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	yield* Effect.log(`Generated app: pnpm run ${script}`);
	const code = yield* spawner.exitCode(
		ChildProcess.make("pnpm", ["run", script], {
			cwd,
			env: { "TEST_DATABASE_URL": database },
			extendEnv: true,
			stderr: "inherit",
			stdout: "inherit",
		}),
	);
	yield* requireThat(code === 0, `Generated app: pnpm run ${script} failed (exit ${code}).`);
});
