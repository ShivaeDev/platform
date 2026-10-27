import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { githubToken as watcherToken } from "@shivaedev/pr-watch/githubToken.ts";

export const githubToken = watcherToken.pipe(
	Layer.catchTag("WatchError", (error) => Layer.effect(GitHubToken)(Effect.fail(new ServiceUnavailable({ message: error.message })))),
);
