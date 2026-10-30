import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";

export const githubToken = GitHubToken.fromEnvOrCli.pipe(
	Layer.catchTag("GitHubTokenError", (error) => {
		const unavailable = new ServiceUnavailable({ message: error.message });
		Object.defineProperty(unavailable, "cause", { value: error });
		return Layer.effect(GitHubToken)(Effect.fail(unavailable));
	}),
);
