import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { httpClient } from "#test/http-client/story.ts";

export function remoteAnswers(status: number, headers: Readonly<Record<string, string>> = {}) {
	const sent = Object.entries(headers).map(([name, value]) => ` and ${name}: ${value}`);
	return httpClient.trait("routes", `the remote answers POST /answer with HTTP ${status}${sent.join("")}`, ({ replies }) => {
		replies.answer = { body: { item: "paper" }, headers: { "x-request-id": "remote-1", ...headers }, status };
	});
}

export function remoteExplains(status: number, body: string | Uint8Array, described = JSON.stringify(body)) {
	return httpClient.trait("routes", `the remote answers POST /answer with HTTP ${status} and the body ${described}`, ({ replies }) => {
		replies.answer = { chunks: [body], status };
	});
}

export function remoteExplainsAndHoldsOpen(status: number, body: string, described: string) {
	return httpClient.trait(
		"routes",
		`the remote answers POST /answer with HTTP ${status}, sends ${described} and holds the rest of the body open`,
		function* ({ replies }) {
			const gate = Promise.withResolvers<void>();
			yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
			replies.answer = {
				chunks: (async function* () {
					yield body;
					await gate.promise;
				})(),
				status,
			};
		},
	);
}

export const clockReadsTenSeconds = httpClient.trait("routes", "the clock reads 00:00:10", function* () {
	yield* TestClock.adjust("10 seconds");
});
