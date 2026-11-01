import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, type HttpClientResponse } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoundedJson } from "#body.ts";
import { filterStatus } from "#filterStatus.ts";
import { connections, type Reply } from "./connections.ts";

function byteLimit(reply: Reply) {
	if (reply === "invalid") {
		return Number.NaN;
	}
	return reply === "schema" || reply === "ok" ? 100 : 10;
}

export function rejections(transport: "fetch" | "node") {
	return storyKit({
		clock: "live",
		*create() {
			const remote = yield* connections;
			const layer = transport === "fetch" ? FetchHttpClient.layer : NodeHttpClient.layerNodeHttpOptions({ keepAlive: true, maxSockets: 1 });
			const context = yield* Layer.build(layer);
			const transportClient = yield* HttpClient.HttpClient.pipe(Effect.provide(context));
			// Keep garbage collection from making a leaked body look released.
			const responses: HttpClientResponse.HttpClientResponse[] = [];
			const client = filterStatus(HttpClient.tap(transportClient, (response) => Effect.sync(() => responses.push(response))));
			return { client, remote, responses };
		},
		name: `${transport} response rejection`,
		stages: [],
		verbs: ({ client, remote }, story) => ({
			connectionClosed: () => {
				story.tell("the server waits for the rejected connection to close");
				return Effect.promise(() => remote.closed.at(-1) ?? Promise.reject(new Error("No response received"))).pipe(
					Effect.as("closed"),
					Effect.timeout("3 seconds"),
				);
			},
			connectionsSeen: () => Effect.sync(() => remote.ports),
			read: (reply: Reply) => {
				const limit = byteLimit(reply);
				story.tell(`the client reads /${reply} as JSON within ${limit} bytes from the loopback server`);
				return client.get(`${remote.url}/${reply}`).pipe(
					Effect.flatMap((response) => readBoundedJson(response, limit, Schema.Struct({ name: Schema.String }))),
					Effect.catchTag("RemoteNotFound", () => Effect.succeed("RemoteNotFound")),
					Effect.catchTag("ResponseBodyTooLarge", () => Effect.succeed("ResponseBodyTooLarge")),
					Effect.catchTag("InvalidBodyLimit", () => Effect.succeed("InvalidBodyLimit")),
					Effect.catchTag("SchemaError", () => Effect.succeed("SchemaError")),
					Effect.timeout("3 seconds"),
				);
			},
		}),
	});
}
