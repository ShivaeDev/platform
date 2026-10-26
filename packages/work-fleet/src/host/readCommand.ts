import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";

export function readCommand(command: string, args: readonly string[], cwd?: string, input?: string) {
	return Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const process = yield* spawner.spawn(
				ChildProcess.make(command, args, {
					...(cwd === undefined ? {} : { cwd }),
					...(input === undefined ? {} : { stdin: Stream.make(new TextEncoder().encode(input)) }),
				}),
			);
			const output = yield* process.stdout.pipe(Stream.decodeText, Stream.mkString);
			if ((yield* process.exitCode) !== 0) {
				return yield* Effect.fail(new ServiceUnavailable({ message: `${command} could not read report evidence` }));
			}
			return output;
		}),
	).pipe(
		Effect.timeout("60 seconds"),
		Effect.mapError(() => new ServiceUnavailable({ message: `${command} could not read report evidence` })),
	);
}
