import { Effect, Schema, Stream } from "effect";
import { HttpClientRequest, type HttpClientResponse } from "effect/http";
import { readBoundedBody, readBoundedJson, readBoundedText } from "#body.ts";
import { paginate } from "#paginate.ts";
import type { ClientEngine } from "./engine.ts";
import { failureOf, isStatusError } from "./failures.ts";

const Items = Schema.Array(Schema.String);
const Named = Schema.Struct({ name: Schema.String });

const bounded = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, format: "bytes" | "text" | "json", limit: number) {
	switch (format) {
		case "bytes":
			return yield* readBoundedBody(response, limit);
		case "text":
			return yield* readBoundedText(response, limit);
		case "json":
			return yield* readBoundedJson(response, limit, Schema.String);
	}
});

export function clientVerbs({ client, rawClient, otherOrigin, remote, statusFailures }: ClientEngine, story: { tell: (line: string) => void }) {
	function pathOf(url: string) {
		return url.startsWith(remote.url) ? url.slice(remote.url.length) : url;
	}
	function answered<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.catch(effect, (error) => {
			const described = failureOf(error, pathOf);
			if (described === undefined) {
				return Effect.fail(error);
			}
			if (isStatusError(error)) {
				statusFailures.push(error);
			}
			return Effect.succeed(described);
		});
	}
	const pages = paginate(client(), HttpClientRequest.get(`${remote.url}/pages/1`, { urlParams: { token: "private" } }));
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
		return client().get(`${remote.url}/body`);
	}
	return {
		failureMessage: () => Effect.sync(() => statusFailures.at(-1)?.message),
		otherOriginRequests: () => Effect.sync(() => otherOrigin.requests.map(({ method, path }) => `${method} ${path}`)),
		post: () => {
			story.tell("the client POSTs /answer?token=private");
			return answered(
				Effect.gen(function* () {
					const response = yield* client().execute(HttpClientRequest.post(`${remote.url}/answer?token=private`));
					return { body: yield* response.json, requestId: response.headers["x-request-id"], status: response.status };
				}),
			);
		},
		readBody: (format: "bytes" | "text" | "json", limit: number, method: "GET" | "HEAD" = "GET") => {
			story.tell(`the client ${method}s /body and reads ${format} within ${limit} bytes`);
			return answered(
				rawClient()
					.execute(HttpClientRequest.make(method)(`${remote.url}/body`))
					.pipe(Effect.flatMap((response) => bounded(response, format, limit))),
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
		readPaper: () => {
			story.tell("the client reads /paper within 5 bytes");
			return answered(
				client()
					.get(`${remote.url}/paper`)
					.pipe(Effect.flatMap((response) => readBoundedText(response, 5))),
			);
		},
		readText: (limit: number) => answered(Effect.flatMap(body(`as text within ${limit} bytes`), (response) => readBoundedText(response, limit))),
		refusedRequest: () =>
			Effect.sync(() => {
				const refused = statusFailures.at(-1);
				return refused === undefined ? "nothing refused" : `${refused.method} ${pathOf(refused.url)}`;
			}),
		remoteHost: () => Effect.sync(() => new URL(remote.url).host),
		requests: () => Effect.sync(() => remote.requests.map(({ method, path }) => `${method} ${path}`)),
	};
}
