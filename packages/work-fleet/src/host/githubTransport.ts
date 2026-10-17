import { Context, Effect, Layer, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";

export interface GithubResponse {
	readonly exitCode: number;
	readonly output: string;
}
export class GithubTransport extends Context.Service<GithubTransport, (args: readonly string[]) => Effect.Effect<GithubResponse, FleetError>>()(
	"Fleet/GithubTransport",
) {}

export const ghTransport = Layer.effect(GithubTransport)(
	Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		return (args: readonly string[]) =>
			Effect.scoped(
				Effect.gen(function* () {
					const process = yield* spawner.spawn(ChildProcess.make("gh", args));
					const output = yield* process.stdout.pipe(Stream.decodeText, Stream.mkString);
					return { exitCode: Number(yield* process.exitCode), output };
				}),
			).pipe(
				Effect.timeout("60 seconds"),
				Effect.mapError(
					() => new ServiceUnavailable({ message: "GitHub evidence could not be read; check gh authentication and repository access" }),
				),
			);
	}),
);
