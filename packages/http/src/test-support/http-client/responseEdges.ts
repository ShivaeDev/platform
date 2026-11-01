import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoundedBody, readBoundedJson, readBoundedText } from "#body.ts";

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

function reply(request: IncomingMessage, response: ServerResponse) {
	const path = request.url ?? "";
	const status =
		new Map([
			["/204", 204],
			["/205", 205],
			["/304", 304],
		]).get(path) ?? 200;
	const compressed = path === "/compressed-small" || path === "/compressed-large";
	const text = path === "/compressed-large" ? "x".repeat(128) : "paper";
	const body = compressed ? gzipSync(text) : Buffer.from(text);
	response.writeHead(status, {
		...(compressed ? { "content-encoding": "gzip" } : {}),
		...(status === 204 || status === 205 ? {} : { "content-length": String(path === "/empty" ? 0 : body.byteLength) }),
	});
	response.end(status !== 200 || path === "/empty" ? undefined : body);
}

export function responseEdges(transport: "fetch" | "node") {
	return storyKit({
		clock: "live",
		*create() {
			const server = createServer(reply);
			const close = Effect.promise(
				() =>
					new Promise<void>((resolve) => {
						server.close(() => resolve());
						server.closeAllConnections();
					}),
			);
			yield* Effect.acquireRelease(
				Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))),
				() => close,
			);
			const address = server.address();
			if (address === null || typeof address === "string") {
				return yield* Effect.die("Expected a loopback TCP server");
			}
			const context = yield* Layer.build(
				transport === "fetch" ? FetchHttpClient.layer : NodeHttpClient.layerNodeHttpOptions({ keepAlive: true, maxSockets: 1 }),
			);
			const client = yield* HttpClient.HttpClient.pipe(Effect.provide(context));
			const responses: HttpClientResponse.HttpClientResponse[] = [];
			return { client, responses, url: `http://127.0.0.1:${address.port}` };
		},
		name: `${transport} bounded response edges`,
		stages: [],
		verbs: ({ client, responses, url }, story) => ({
			read: (path: string, format: "bytes" | "text" | "json", limit: number, method: "GET" | "HEAD" = "GET") => {
				story.tell(`the client ${method}s ${path} and reads ${format} within ${limit} bytes`);
				return client.execute(HttpClientRequest.make(method)(`${url}${path}`)).pipe(
					Effect.tap((response) => Effect.sync(() => responses.push(response))),
					Effect.flatMap((response) => bounded(response, format, limit)),
					Effect.catchTag("ResponseBodyTooLarge", () => Effect.succeed("body too large")),
					Effect.catchTag("SchemaError", () => Effect.succeed("invalid JSON")),
					Effect.catchTag("InvalidBodyLimit", () => Effect.succeed("invalid limit")),
					Effect.timeout("3 seconds"),
				);
			},
		}),
	});
}
