import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import { answerOf, errorWords, words } from "@shivaedev/test/answers.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { otlpHttpClient } from "#otlpHttpClient.ts";

export const collectorResponses = storyKit({
	clock: "live",
	*create() {
		const gate = Promise.withResolvers<void>();
		yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
		const reply: { chunks: string[]; headers: Record<string, string>; held: boolean } = { chunks: [], headers: {}, held: false };
		async function* chunks() {
			yield* reply.chunks;
			if (reply.held) {
				await gate.promise;
			}
		}
		const collector = yield* fakeHttpService({
			routes: {
				traces: {
					method: "POST",
					path: "/v1/traces",
					reply: () => ({
						chunks: chunks(),
						headers: reply.headers,
					}),
				},
			},
		});
		const context = yield* Layer.build(otlpHttpClient());
		const client = yield* HttpClient.HttpClient.pipe(Effect.provide(context));
		return { client, collector, reply };
	},
	name: "OTLP collector responses",
	stages: ["configured"],
	verbs: ({ client, collector }, story) => ({
		connection: () => collector.untilAbandoned(() => true, { name: "collector connection closes", timeout: "3 seconds" }).pipe(Effect.as("closed")),
		post: () => {
			story.tell("the OTLP client posts to the real HTTP collector and reads its answer");
			return client.post(`${collector.url}/v1/traces`).pipe(
				Effect.flatMap((response) => response.text),
				Effect.exit,
				Effect.map((exit) => answerOf(exit, (error) => (HttpClientError.isHttpClientError(error) ? words(error.reason._tag) : errorWords(error)))),
			);
		},
	}),
});

export function oversizedResponse(framing: "length" | "chunked") {
	return collectorResponses.trait("configured", `the collector sends an oversized ${framing} response and holds it open`, ({ reply }) => {
		reply.held = true;
		reply.chunks = framing === "length" ? ["held"] : ["a".repeat(32_768), "b".repeat(32_769)];
		reply.headers = framing === "length" ? { "Content-Length": "65537" } : {};
	});
}

export function collectorAnswer(body: string) {
	return collectorResponses.trait("configured", `the collector answers with ${new TextEncoder().encode(body).byteLength} bytes`, ({ reply }) => {
		reply.chunks = [body];
	});
}
