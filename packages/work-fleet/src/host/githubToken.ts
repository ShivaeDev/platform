import { Config, Effect, Layer, Option, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { GitHubToken } from "@shivaedev/effect-github/GitHubToken.ts";

export const githubToken = Layer.effect(GitHubToken)(
	Effect.gen(function* () {
		const configured = yield* Config.Redacted("GH_TOKEN").pipe(
			Config.orElse(() => Config.Redacted("GITHUB_TOKEN")),
			Config.option,
		);
		if (Option.isSome(configured)) {
			return configured;
		}
		return yield* Effect.scoped(
			Effect.gen(function* () {
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const process = yield* spawner.spawn(ChildProcess.make("gh", ["auth", "token"], { stderr: "ignore" }));
				const token = yield* process.stdout.pipe(
					Stream.decodeText,
					Stream.mkString,
					Effect.map((value) => Redacted.make(value.trim())),
				);
				if (Number(yield* process.exitCode) !== 0) {
					return yield* Effect.fail(undefined);
				}
				return Option.some(token);
			}),
		);
	}).pipe(
		Effect.mapError(() => new ServiceUnavailable({ message: "GitHub authentication unavailable; set GH_TOKEN or GITHUB_TOKEN, or sign in with gh" })),
	),
);
