import { Config, Context, Effect, Layer, type Option, type Redacted } from "effect";

export class GitHubToken extends Context.Service<GitHubToken, Option.Option<Redacted.Redacted<string>>>()("@shivaedev/effect-github/GitHubToken") {
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
