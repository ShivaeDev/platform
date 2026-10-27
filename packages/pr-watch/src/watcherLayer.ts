import { NodeFileSystem } from "@effect/platform-node";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub as GitHubClient } from "@shivaedev/github/GitHub.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { StateFile } from "#StateFile.ts";
import { Watcher } from "#Watcher.ts";

export const watcherLayer = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(GitHubToken.fromEnv)))),
		),
	),
	Layer.provide(
		Layer.mergeAll(
			NodeFileSystem.layer,
			FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }))),
		),
	),
);
