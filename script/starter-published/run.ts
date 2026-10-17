import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { requireThat } from "#package-check/io.ts";

export const runStarter = Effect.fn("Published.runStarter")(function* (cwd: string, database: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	yield* Effect.log("Generated app: pnpm run ci");
	const code = yield* spawner.exitCode(
		ChildProcess.make("pnpm", ["run", "ci"], {
			cwd,
			env: { "PLATFORM_EFFECT_SQL_TEST_DATABASE_URL": database, "TEST_DATABASE_URL": database },
			extendEnv: true,
			stderr: "inherit",
			stdout: "inherit",
		}),
	);
	yield* requireThat(code === 0, `Generated app: pnpm run ci failed (exit ${code}).`);
});
