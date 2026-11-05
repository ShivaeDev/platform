import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub } from "@shivaedev/github/github/service.ts";

export const githubLayer = GitHub.layer.pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(GitHubToken.fromEnv));
