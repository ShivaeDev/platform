import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { FleetFailure } from "#policy.ts";

export const githubRead = Effect.fn("Fleet.githubRead")(function* (args: readonly string[], cwd?: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const process = yield* spawner.spawn(ChildProcess.make("gh", args, { cwd }));
			const output = yield* process.stdout.pipe(Stream.decodeText, Stream.mkString);
			if ((yield* process.exitCode) !== 0) {
				return yield* new FleetFailure({ message: "GitHub request failed", reason: "integration" });
			}
			return output;
		}),
	).pipe(
		Effect.timeout("60 seconds"),
		Effect.mapError(
			() => new FleetFailure({ message: "GitHub could not be read; check gh authentication and repository access", reason: "integration" }),
		),
	);
});
