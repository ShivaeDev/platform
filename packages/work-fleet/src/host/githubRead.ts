import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";

export const githubRead = Effect.fn("Fleet.githubRead")(function* (args: readonly string[], cwd?: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const process = yield* spawner.spawn(ChildProcess.make("gh", args, cwd === undefined ? {} : { cwd }));
			const output = yield* process.stdout.pipe(Stream.decodeText, Stream.mkString);
			if ((yield* process.exitCode) !== 0) {
				return yield* new ServiceUnavailable({ message: "GitHub request failed" });
			}
			return output;
		}),
	).pipe(
		Effect.timeout("60 seconds"),
		Effect.mapError(() => new ServiceUnavailable({ message: "GitHub evidence could not be read; check gh authentication and repository access" })),
	);
});
