import process from "node:process";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { requireThat } from "#package-check/io.ts";

export const runStarter = Effect.fn("Published.runStarter")(function* (cwd: string, database: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	yield* Effect.log("Generated app: pnpm run ci");
	const child = yield* spawner.spawn(
		ChildProcess.make("pnpm", ["run", "ci"], {
			cwd,
			env: { "TEST_DATABASE_URL": database },
			extendEnv: true,
		}),
	);
	const [stdout, stderr, code] = yield* Effect.all(
		[
			child.stdout.pipe(
				Stream.tap((chunk) => Effect.sync(() => process.stdout.write(chunk))),
				Stream.decodeText,
				Stream.mkString,
			),
			child.stderr.pipe(
				Stream.tap((chunk) => Effect.sync(() => process.stderr.write(chunk))),
				Stream.decodeText,
				Stream.mkString,
			),
			child.exitCode,
		],
		{ concurrency: "unbounded" },
	);
	const warnings = `${stdout}\n${stderr}`.split(/\r?\n/u).filter((line) => line.includes("Timeout terminating forks worker"));
	yield* requireThat(warnings.length === 0, `Generated app in ${cwd}: Vitest workers did not exit cleanly:\n${warnings.join("\n")}`);
	yield* requireThat(code === 0, `Generated app: pnpm run ci failed (exit ${code}).`);
}, Effect.scoped);
