import { Config, Context, Effect, Layer, type Option, type Redacted } from "effect";
import type { GitHubAppError } from "./errors.ts";

type Token = Option.Option<Redacted.Redacted<string>>;

export class GitHubToken extends Context.Service<GitHubToken, Token | Effect.Effect<Token, GitHubAppError>>()("@shivaedev/github/GitHubToken") {
	static readonly fromEnv = Layer.effect(GitHubToken)(
		Effect.gen(function* () {
			const token = yield* Config.Redacted("GH_TOKEN").pipe(
				Config.orElse(() => Config.Redacted("GITHUB_TOKEN")),
				Config.option,
			);
			return token;
		}),
	);
}
