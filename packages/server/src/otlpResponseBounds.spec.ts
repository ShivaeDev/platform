import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collectorAnswer, collectorResponses, oversizedResponse } from "#test/otlpResponses.ts";

for (const framing of ["length", "chunked"] as const) {
	collectorResponses.it(
		`an oversized ${framing} collector response fails with a typed decode error and closes while the collector holds it open`,
		[oversizedResponse(framing)],
		function* ({ connection, post }) {
			const answer = yield* post();

			yield* outcomes([
				["answer", () => Effect.succeed(answer), "failed with decode error"],
				["connection", connection, "closed"],
			]);
		},
	);
}

const exactLimit = "é".repeat(32_768);
collectorResponses.it("a collector response of exactly 64 KiB remains readable as UTF-8 text", [collectorAnswer(exactLimit)], function* ({ post }) {
	expect(yield* post()).toBe(exactLimit);
});
