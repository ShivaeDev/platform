import { Effect, Option, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runCommand } from "#runCommand.ts";

export const containerReady = Effect.fn("Container.containerReady")(function* (name: string) {
	const since = yield* runCommand("docker", ["inspect", "--format", "{{.State.StartedAt}}", name]);
	yield* Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const logs = yield* spawner.spawn(ChildProcess.make("docker", ["logs", "--follow", "--since", since, name]));
			// The initialization server accepts only socket connections; wait for the final TCP server.
			let listening = false;
			const ready = yield* logs.stderr.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.filter((line) => {
					listening ||= line.includes("listening on IPv4 address");
					return listening && line.includes("database system is ready to accept connections");
				}),
				Stream.runHead,
			);
			if (Option.isNone(ready)) {
				return yield* Effect.die(new Error(`PostgreSQL in ${name} exited before accepting connections`));
			}
		}),
	);
});
