import { Config, Context, Effect, Layer, Option, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { type GitHubAppError, GitHubTokenError } from "./errors.ts";

type Token = Option.Option<Redacted.Redacted<string>>;
const environmentToken = Config.Redacted("GH_TOKEN").pipe(
	Config.orElse(() => Config.Redacted("GITHUB_TOKEN")),
	Config.option,
);

export class GitHubToken extends Context.Service<GitHubToken, Token | Effect.Effect<Token, GitHubAppError>>()("@shivaedev/github/GitHubToken") {
	static readonly fromEnv = Layer.effect(GitHubToken)(environmentToken);

	static readonly fromEnvOrCli = Layer.effect(GitHubToken)(
		Effect.gen(function* () {
			const token = yield* environmentToken.pipe(Effect.mapError((cause) => new GitHubTokenError({ reason: "config" }, { cause })));
			if (Option.isSome(token)) {
				return token;
			}
			return yield* Effect.scoped(
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const child = yield* spawner.spawn(ChildProcess.make("gh", ["auth", "token"], { stderr: "ignore" }));
					const output = yield* child.stdout.pipe(Stream.decodeText, Stream.mkString);
					const exit = yield* child.exitCode;
					if (Number(exit) !== 0) {
						return yield* Effect.fail(new GitHubTokenError({ reason: "refused" }, { cause: exit }));
					}
					return Option.some(Redacted.make(output.trim()));
				}).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new GitHubTokenError({ reason: "command" }, { cause })))),
			);
		}),
	);
}
