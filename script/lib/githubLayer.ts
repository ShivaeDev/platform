import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";

export const githubLayer = GitHub.layer.pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(GitHubToken.fromEnv));
