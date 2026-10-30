import { DateTime, Effect, Schema, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { type FakeHttpReply, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoundedBody, readBoundedJson, readBoundedText } from "#body.ts";
import {
	PaginationLinkError,
	RemoteGone,
	RemoteHttpError,
	RemoteNotFound,
	RemoteRateLimited,
	type RemoteStatusError,
	RemoteUnauthorized,
	ResponseBodyTooLarge,
} from "#errors.ts";
import { filterStatus } from "#filterStatus.ts";
import { paginate } from "#paginate.ts";

const Items = Schema.Array(Schema.String);
const Named = Schema.Struct({ name: Schema.String });
const STATUS_ERRORS = [RemoteUnauthorized, RemoteNotFound, RemoteGone, RemoteRateLimited, RemoteHttpError];

function instant(at: DateTime.Utc) {
	return DateTime.formatIso(at)
		.replace("T", " ")
		.replace(/\.\d+Z$/u, " UTC");
}

function on<T>(type: abstract new (...args: never[]) => T, phrase: (error: T) => string) {
	return (error: unknown) => (error instanceof type ? phrase(error) : undefined);
}

function failureOf(error: unknown, pathOf: (url: string) => string) {
	const phrases = [
		on(RemoteUnauthorized, () => "unauthorized"),
		on(RemoteNotFound, () => "not found"),
		on(RemoteGone, () => "gone"),
		on(RemoteRateLimited, ({ retryAfter }) => (retryAfter === undefined ? "rate limited" : `rate limited until ${instant(retryAfter)}`)),
		on(RemoteHttpError, ({ status }) => `HTTP ${status}`),
		on(ResponseBodyTooLarge, ({ limit }) => `body over ${limit} bytes`),
		on(PaginationLinkError, ({ reason, url }) => `${reason} next link on ${pathOf(url)}`),
		on(Schema.SchemaError, () => "Schema mismatch"),
	];
	for (const phrase of phrases) {
		const described = phrase(error);
		if (described !== undefined) {
			return described;
		}
	}
	return `unexpected failure: ${String(error)}`;
}

function isStatusError(error: unknown): error is RemoteStatusError {
	return STATUS_ERRORS.some((type) => error instanceof type);
}

export const httpClient = storyKit({
	*create() {
		const replies: { answer: FakeHttpReply; body: FakeHttpReply } = { answer: { status: HttpStatus.fromLiteral("OK") }, body: {} };
		const links = new Map<number, string>();
		const statusFailures: RemoteStatusError[] = [];
		const otherOrigin = yield* fakeHttpService({ routes: { page: { path: "/page", reply: () => ({ body: ["foreign"] }) } } });
		const remote = yield* fakeHttpService({
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
		return { client, links, otherOrigin, remote, replies, statusFailures };
	},
	inspect: ({ otherOrigin, remote }) => ({
		otherOriginRequests: otherOrigin.requests.map(({ path }) => path),
		requests: remote.requests.map(({ path }) => path),
	}),
	name: "outbound HTTP client",
	stages: ["routes"],
	verbs: ({ client, otherOrigin, remote, statusFailures }, story) => {
		remote.narrate(story.tell);
		function pathOf(url: string) {
			return url.startsWith(remote.url) ? url.slice(remote.url.length) : url;
		}
		function answered<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return Effect.catch(effect, (error) =>
				Effect.sync(() => {
					if (isStatusError(error)) {
						statusFailures.push(error);
					}
					return failureOf(error, pathOf);
				}),
			);
		}
		const pages = paginate(client, HttpClientRequest.get(`${remote.url}/pages/1`, { urlParams: { token: "private" } }));
		function itemsOf(stream: typeof pages) {
			return answered(
				stream.pipe(
					Stream.mapEffect((response) => readBoundedJson(response, 1024, Items)),
					Stream.runCollect,
					Effect.map((items) => items.flat()),
				),
			);
		}
		function body(reading: string) {
			story.tell(`the client GETs /body and reads it ${reading}`);
			return client.get(`${remote.url}/body`);
		}
		return {
			otherOriginRequests: () => Effect.sync(() => otherOrigin.requests.map(({ method, path }) => `${method} ${path}`)),
			post: () => {
				story.tell("the client POSTs /answer?token=private");
				return answered(
					Effect.gen(function* () {
						const response = yield* client.execute(HttpClientRequest.post(`${remote.url}/answer?token=private`));
						return { body: yield* response.json, requestId: response.headers["x-request-id"], status: response.status };
					}),
				);
			},
			readBytes: (limit: number) => answered(Effect.flatMap(body(`within ${limit} bytes`), (response) => readBoundedBody(response, limit))),
			readEveryPage: () => {
				story.tell("the client reads every page from /pages/1?token=private");
				return itemsOf(pages);
			},
			readFirstPage: () => {
				story.tell("the client takes only the first page of /pages/1?token=private");
				return itemsOf(pages.pipe(Stream.take(1)));
			},
			readJson: (limit: number) =>
				answered(Effect.flatMap(body(`as JSON { name: string } within ${limit} bytes`), (response) => readBoundedJson(response, limit, Named))),
			readText: (limit: number) => answered(Effect.flatMap(body(`as text within ${limit} bytes`), (response) => readBoundedText(response, limit))),
			refusedRequest: () =>
				Effect.sync(() => {
					const refused = statusFailures.at(-1);
					return refused === undefined ? "nothing refused" : `${refused.method} ${pathOf(refused.url)}`;
				}),
			requests: () => Effect.sync(() => remote.requests.map(({ method, path }) => `${method} ${path}`)),
		};
	},
});

export function remoteAnswers(status: number, headers: Readonly<Record<string, string>> = {}) {
	const sent = Object.entries(headers).map(([name, value]) => ` and ${name}: ${value}`);
	return httpClient.trait("routes", `the remote answers POST /answer with HTTP ${status}${sent.join("")}`, ({ replies }) => {
		replies.answer = { body: { item: "paper" }, headers: { "x-request-id": "remote-1", ...headers }, status };
	});
}

export const clockReadsTenSeconds = httpClient.trait("routes", "the clock reads 00:00:10", function* () {
	yield* TestClock.adjust("10 seconds");
});

export const threeLinkedPages = httpClient.trait(
	"routes",
	"the remote lists paper, ink and pens one to a page; page 1 links next to the relative 2?cursor=two with a quoted comma before its rel, and page 2 links next to the absolute /pages/3",
	({ links }) => {
		links.set(1, '<../other>; rel=prev, <2?cursor=two>; title="ink, page 2"; rel="alternate next"');
		links.set(2, '<1>; rel="prev", </pages/3>; rel=next');
		links.set(3, '<2>; rel="prev"');
	},
);

export const pageOneLinksToAnotherOrigin = httpClient.trait(
	"routes",
	"page 1 links next to /page?token=private on another origin",
	({ links, otherOrigin }) => {
		links.set(1, `<${otherOrigin.url}/page?token=private>; rel="next"`);
	},
);

function chunkSizes(chunks: readonly (string | Uint8Array)[]) {
	return chunks.map((chunk) => (typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk).byteLength).join(" + ");
}

export function remoteSends(...chunks: readonly (string | Uint8Array)[]) {
	return httpClient.trait("routes", `the remote sends /body in chunks of ${chunkSizes(chunks)} bytes`, ({ replies }) => {
		replies.body = { chunks };
	});
}

export function remoteSendsJson(body: unknown) {
	return httpClient.trait("routes", `the remote sends /body as the JSON ${JSON.stringify(body)}`, ({ replies }) => {
		replies.body = { body };
	});
}

function heldBody(line: string, chunks: readonly string[], headers: Readonly<Record<string, string>> = {}) {
	return httpClient.trait("routes", line, function* ({ replies }) {
		const gate = Promise.withResolvers<void>();
		yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
		replies.body = {
			chunks: (async function* () {
				yield* chunks;
				await gate.promise;
			})(),
			headers,
		};
	});
}

export const remoteDeclaresOversizedBody = heldBody(
	"the remote declares Content-Length: 1000 for /body, sends 8 bytes and holds the rest",
	["abcdefgh"],
	{ "Content-Length": "1000" },
);

export const remoteStreamsSixteenBytes = heldBody("the remote streams 16 bytes of /body in chunks of 8 + 8 and holds the response open", [
	"abcdefgh",
	"ijklmnop",
]);
