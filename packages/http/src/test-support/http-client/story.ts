import { Effect, Schema, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { type FakeHttpReply, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoundedBody, readBoundedJson, readBoundedText } from "#body.ts";
import { filterStatus } from "#filterStatus.ts";
import { paginate } from "#paginate.ts";

const Items = Schema.Array(Schema.String);

export const httpClient = storyKit({
	*create() {
		const replies: { answer: FakeHttpReply; body: FakeHttpReply } = { answer: { status: 200 }, body: {} };
		const links = new Map([
			[1, '<../other>; rel=prev; title="with, comma", <2?cursor=two>; type="application/json"; rel="alternate next"'],
			[2, '<1>; rel="prev", </pages/3>; rel=next'],
			[3, '<2>; rel="prev"'],
		]);
		const foreign = yield* fakeHttpService({ routes: { page: { path: "/page", reply: () => ({ body: ["foreign"] }) } } });
		const service = yield* fakeHttpService({
			routes: {
				answer: { method: "POST", path: "/answer", reply: () => replies.answer },
				body: { path: "/body", reply: () => replies.body },
				page: {
					path: "/pages/:page",
					reply: ({ params }) => ({
						body: ["paper", "ink", "pens"].slice(Number(params.page) - 1, Number(params.page)),
						headers: { Link: links.get(Number(params.page)) ?? "" },
					}),
				},
			},
		});
		const client = filterStatus(yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer)));
		return { client, foreign, links, replies, service };
	},
	inspect: ({ service, foreign }) => ({ foreignRequests: foreign.requests.length, requests: service.requests.map(({ path }) => path) }),
	name: "outbound HTTP client",
	stages: ["routes"],
	verbs: ({ client, foreign, service }, story) => {
		service.narrate(story.tell);
		const pages = paginate(client, HttpClientRequest.get(`${service.url}/pages/1`, { urlParams: { token: "private" } }));
		function body() {
			story.tell("GET /body");
			return client.get(`${service.url}/body`);
		}
		return {
			answer: () => {
				story.tell("POST /answer with a private query and header");
				return client.execute(HttpClientRequest.post(`${service.url}/answer?token=private`, { headers: { authorization: "secret" } }));
			},
			bytes: (limit: number) => Effect.flatMap(body(), (response) => readBoundedBody(response, limit)),
			foreignRequests: () => foreign.requests.map(({ path }) => path),
			json: <TSchema extends Schema.Constraint>(limit: number, schema: TSchema) =>
				Effect.flatMap(body(), (response) => readBoundedJson(response, limit, schema)),
			readPages: (count?: number) => {
				story.tell(count === undefined ? "GET every Link page" : `GET the first ${count} Link pages`);
				return (count === undefined ? pages : pages.pipe(Stream.take(count))).pipe(
					Stream.mapEffect((response) => readBoundedJson(response, 1024, Items)),
					Stream.runCollect,
					Effect.map((items) => items.flat()),
				);
			},
			requests: () => service.requests.map(({ method, path }) => ({ method, path })),
			text: (limit: number) => Effect.flatMap(body(), (response) => readBoundedText(response, limit)),
			url: () => service.url,
		};
	},
});

export function routeAnswers(status: number, headers: Record<string, string> = {}) {
	return httpClient.trait("routes", `a route answers HTTP ${status}`, ({ replies }) => {
		replies.answer = { body: { secret: "remote-body" }, headers: { "x-secret": "remote-header", ...headers }, status };
	});
}

export const crossOriginPage = httpClient.trait("routes", "a route pages with a Link to another origin", ({ links, foreign }) => {
	links.set(1, `<${foreign.url}/page?token=private>; rel="next"`);
});

export function routeBody(reply: FakeHttpReply) {
	return httpClient.trait("routes", "a route answers with a response body", ({ replies }) => {
		replies.body = reply;
	});
}

export function oversizedBody(contentLength: boolean) {
	return httpClient.trait(
		"routes",
		contentLength ? "a route declares an oversized body" : "a route streams an oversized chunked body",
		function* ({ replies }) {
			const gate = Promise.withResolvers<void>();
			yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
			replies.body = {
				chunks: (async function* () {
					yield "abcdefgh";
					if (!contentLength) {
						yield "ijklmnop";
					}
					await gate.promise;
				})(),
				...(contentLength ? { headers: { "Content-Length": "1000" } } : {}),
			};
		},
	);
}
