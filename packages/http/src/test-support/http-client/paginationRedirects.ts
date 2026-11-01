import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { filterStatus } from "#filterStatus.ts";
import { paginate } from "#paginate.ts";

export function paginationRedirects(transport: "fetch" | "node") {
	return storyKit({
		*create() {
			const foreign = yield* fakeHttpService({
				routes: { page: { path: "/page", reply: () => ({ body: "foreign", headers: { link: '</next>; rel="next"' } }) } },
			});
			const remote = yield* fakeHttpService({
				routes: {
					first: { path: "/first", reply: () => ({ body: "paper", headers: { link: '</redirect>; rel="next"' } }) },
					last: { path: "/last", reply: () => ({ body: "ink" }) },
					localRedirect: { path: "/local-redirect", reply: () => ({ headers: { location: "/last" }, status: 302 }) },
					redirect: { path: "/redirect", reply: () => ({ headers: { location: `${foreign.url}/page` }, status: 302 }) },
				},
			});
			const context = yield* Layer.build(transport === "fetch" ? FetchHttpClient.layer : NodeHttpClient.layerNodeHttp);
			const client = filterStatus(yield* HttpClient.HttpClient.pipe(Effect.provide(context)));
			return { client, foreign, remote };
		},
		name: `${transport} pagination redirects`,
		stages: [],
		verbs: ({ client, foreign, remote }, story) => {
			remote.narrate(story.tell);
			foreign.narrate(story.tell);
			return {
				defaultHeaders: () => Effect.sync(() => remote.requests.map(({ headers }) => headers["x-client-default"])),
				foreignRequests: () => Effect.sync(() => foreign.requests.map(({ path, headers }) => ({ path, secret: headers["x-api-key"] }))),
				readPages: (path: "/first" | "/redirect" | "/local-redirect" | "/last") => {
					story.tell(`the client paginates ${path} with its custom API key`);
					return paginate(client, HttpClientRequest.get(`${remote.url}${path}`, { headers: { "x-api-key": "private-key" } })).pipe(
						Stream.runDrain,
						Effect.as("finished"),
						Effect.catchTag("HttpClientError", () => Effect.succeed("redirect refused")),
						Effect.catchTag("RemoteHttpError", () => Effect.succeed("redirect refused")),
						Effect.provideService(FetchHttpClient.RequestInit, { headers: { "x-client-default": "kept" }, redirect: "follow" }),
					);
				},
				remoteRequests: () => Effect.sync(() => remote.requests.map(({ path, headers }) => ({ path, secret: headers["x-api-key"] }))),
			};
		},
	});
}
