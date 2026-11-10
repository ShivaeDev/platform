import { Effect, type PlatformError, type Sink, Stdio, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { requireThat } from "#package-check/io.ts";

export const runStarter = Effect.fn("Published.runStarter")(function* (
	cwd: string,
	database: string,
	environment: Readonly<Record<string, string>> = {},
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const stdio = yield* Stdio.Stdio;
	const stdoutSink: Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError> = stdio.stdout();
	const stderrSink: Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError> = stdio.stderr();
	yield* Effect.log("Generated app: pnpm run ready");
	const child = yield* spawner.spawn(
		ChildProcess.make("pnpm", ["run", "ready"], {
			cwd,
			env: { ...environment, "TEST_DATABASE_URL": database },
			extendEnv: true,
		}),
	);
	const [stdout, stderr, code] = yield* Effect.all(
		[
			child.stdout.pipe(Stream.tapSink(stdoutSink), Stream.decodeText, Stream.mkString),
			child.stderr.pipe(Stream.tapSink(stderrSink), Stream.decodeText, Stream.mkString),
			child.exitCode,
		],
		{ concurrency: "unbounded" },
	);
	const warnings = `${stdout}\n${stderr}`.split(/\r?\n/u).filter((line) => line.includes("Timeout terminating forks worker"));
	yield* requireThat(warnings.length === 0, `Generated app in ${cwd}: Vitest workers did not exit cleanly:\n${warnings.join("\n")}`);
	yield* requireThat(code === 0, `Generated app: pnpm run ready failed (exit ${code}).\n${stdout}\n${stderr}`);
}, Effect.scoped);
