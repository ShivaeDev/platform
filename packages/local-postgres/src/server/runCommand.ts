import { Effect, PlatformError, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PostgresCommandError } from "./PostgresCommandError.ts";

export type CommandOptions = Pick<ChildProcess.CommandOptions, "env" | "extendEnv">;

export const runCommand = Effect.fn("LocalPostgres.runCommand")(function* (command: string, args: readonly string[], options: CommandOptions = {}) {
	const label = command === "docker" ? `docker ${args[0] ?? ""}`.trim() : command;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(ChildProcess.make(command, args, { ...options, stdin: "ignore" }));
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			if (code !== 0) {
				return yield* new PostgresCommandError({
					command: label,
					exitCode: Number(code),
					message: stderr.trim() || `${command} exited with code ${code}.`,
				});
			}
			return stdout.trim();
		}),
	).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new PostgresCommandError({ cause, command: label, message: cause.message }))));
});

export function missingCommand(error: PostgresCommandError) {
	return error.cause instanceof PlatformError.PlatformError && error.cause.reason._tag === "NotFound";
}
