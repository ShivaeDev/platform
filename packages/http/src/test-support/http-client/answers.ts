import * as TestClock from "effect/testing/TestClock";
import { httpClient } from "./story.ts";

export function remoteAnswers(status: number, headers: Readonly<Record<string, string>> = {}) {
	const sent = Object.entries(headers).map(([name, value]) => ` and ${name}: ${value}`);
	return httpClient.trait("routes", `the remote answers POST /answer with HTTP ${status}${sent.join("")}`, ({ replies }) => {
		replies.answer = { body: { item: "paper" }, headers: { "x-request-id": "remote-1", ...headers }, status };
	});
}

export const clockReadsTenSeconds = httpClient.trait("routes", "the clock reads 00:00:10", function* () {
	yield* TestClock.adjust("10 seconds");
});
