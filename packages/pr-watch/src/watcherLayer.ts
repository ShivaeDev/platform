import * as NodeServices from "@effect/platform-node/NodeServices";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub as GitHubClient } from "@shivaedev/github/github/service.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { StateFile } from "#StateFile.ts";
import { Watcher } from "#Watcher.ts";

export const watcherLayer = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(GitHubToken.fromEnvOrCli)))),
		),
	),
	Layer.provide(
		Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" })))),
	),
);
