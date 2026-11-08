import { Config, Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const command = Effect.fn("Packed.command")(function* (cwd: string, executable: string, args: readonly string[]) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const count = yield* Config.Int("GIT_CONFIG_COUNT").pipe(Config.withDefault(0));
	// A generated app's initial commit must not leave detached packers racing scoped cleanup.
	const environment = [
		`GIT_CONFIG_COUNT=${count + 2}`,
		`GIT_CONFIG_KEY_${count}=gc.auto`,
		`GIT_CONFIG_VALUE_${count}=0`,
		`GIT_CONFIG_KEY_${count + 1}=maintenance.auto`,
		`GIT_CONFIG_VALUE_${count + 1}=false`,
	];
	const invocation = [...environment, executable, ...args];
	function failed(detail: string) {
		return new Error(`${executable} ${args.join(" ")} failed in ${cwd}: ${detail}`);
	}
	return yield* Effect.gen(function* () {
		const child = yield* spawner.spawn(ChildProcess.make("env", invocation, { cwd }));
		const [stdout, stderr, code] = yield* Effect.all(
			[child.stdout.pipe(Stream.decodeText, Stream.mkString), child.stderr.pipe(Stream.decodeText, Stream.mkString), child.exitCode],
			{ concurrency: "unbounded" },
		);
		if (code !== 0) {
			return yield* Effect.fail(failed(`Error: Command failed: env ${invocation.join(" ")}\n${stderr}\n${stdout}`));
		}
		return stdout;
	}).pipe(
		Effect.scoped,
		Effect.timeoutOrElse({ duration: "180 seconds", orElse: () => Effect.fail(failed("timed out after 180000ms")) }),
		Effect.mapError((cause) => (cause instanceof Error ? cause : failed(String(cause)))),
	);
});
export function writeJson(path: string, value: unknown) {
	return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(path, `${JSON.stringify(value, null, 2)}\n`));
}
export function requireThat(condition: boolean, message: string) {
	return condition ? Effect.void : Effect.fail(new Error(message));
}
