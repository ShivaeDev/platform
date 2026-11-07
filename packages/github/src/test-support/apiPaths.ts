import { Context, Effect, Layer, Redacted, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHub } from "#github/service.ts";
import { githubApp } from "#githubApp.ts";
import { APP_ID, PRIVATE_KEY } from "#test/appFixture.ts";
import { appServer, appServerAt } from "#test/appServer.ts";
import { PullRequest } from "#test/fixtures.ts";

type ApiBase = "" | "/" | "/api/v3" | "/api/v3/";

const PULL = "/repos/acme/widgets/pulls/1";

export const apiPaths = storyKit({
	*create() {
		const root = yield* appServer;
		const enterprise = yield* appServerAt("/api/v3");
		const connect = Effect.fnUntraced(function* (base: ApiBase) {
			const { server } = base.startsWith("/api/v3") ? enterprise : root;
			const environment = Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubConfig)({ apiUrl: `${server.url}${base}` }));
			const credentials = { appId: APP_ID, privateKey: Redacted.make(PRIVATE_KEY) };
			function client(repository: boolean) {
				return Layer.build(
					GitHub.layer.pipe(
						Layer.provide(githubApp(repository ? { ...credentials, owner: "acme", repository: "widgets" } : credentials)),
						Layer.provide(environment),
					),
				).pipe(Effect.map((context) => Context.get(context, GitHub)));
			}
			return { app: yield* client(false), repository: yield* client(true) };
		});
		const clients = {
			"": yield* connect(""),
			"/": yield* connect("/"),
			"/api/v3": yield* connect("/api/v3"),
			"/api/v3/": yield* connect("/api/v3/"),
		};
		return { clients, enterprise, root };
	},
	name: "GitHub API base paths",
	stages: ["github"],
	verbs: ({ clients, enterprise, root }, story) => {
		root.server.narrate(story.tell);
		enterprise.server.narrate(story.tell);
		function client(base: ApiBase) {
			return clients[base];
		}
		function server(base: ApiBase) {
			return (base.startsWith("/api/v3") ? enterprise : root).server;
		}
		return {
			downloadArchive: (base: ApiBase) => {
				story.tell(`the client at ${base || "the origin"} downloads artifact 7`);
				return client(base).repository.downloadArtifactArchive({ artifactId: 7, byteLimit: 1024, owner: "acme", repo: "widgets" });
			},
			listInstallations: (base: ApiBase) => {
				story.tell(`the App at ${base || "the origin"} lists its installations`);
				return client(base).app.list("/app/installations?per_page=1").pipe(Effect.flatMap(Stream.runDrain));
			},
			readPull: (base: ApiBase, path: "leading slash" | "relative" | "absolute" = "leading slash") => {
				story.tell(`the repository client at ${base || "the origin"} reads pull request 1 using a ${path} path`);
				const endpoints = {
					absolute: `${server(base).url}${base.replace(/\/$/u, "")}${PULL}`,
					"leading slash": PULL,
					relative: PULL.slice(1),
				};
				return client(base)
					.repository.read(endpoints[path])
					.pipe(Effect.flatMap((response) => response.decode(PullRequest)));
			},
			readRaw: (base: ApiBase, format: "text" | "bytes") => {
				story.tell(`the repository client at ${base || "the origin"} reads pull request 1 as ${format}`);
				return client(base).repository[format](PULL, "application/vnd.github.raw+json", 1024);
			},
			requests: (base: ApiBase) => Effect.sync(() => server(base).requests.map(({ method, path, status }) => `${method} ${path} ${status}`)),
			writeLabels: (base: ApiBase) => {
				story.tell(`the repository client at ${base || "the origin"} sets the issue labels`);
				return client(base)
					.repository.write("PUT", "/repos/acme/widgets/issues/1/labels", { labels: ["ready"] })
					.pipe(Effect.flatMap((response) => response.decode(Schema.Array(Schema.Struct({ name: Schema.String })))));
			},
		};
	},
});
