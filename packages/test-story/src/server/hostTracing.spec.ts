import { Effect, Option } from "effect";
import { expect } from "vitest";
import { ready, tracingApp } from "#test/tracingApp.ts";

tracingApp.it(
	"each request starts a root trace while story traits and steps retain their span",
	[ready],
	function* ({ request, spans, step, story }) {
		const storySpan = yield* Effect.currentSpan;
		expect(storySpan.name).toBe("story");
		expect(yield* request()).toBe("ok");
		expect(yield* request()).toBe("ok");
		yield* step();

		const requests = spans.filter((span) => span.kind === "server");
		expect(requests).toHaveLength(2);
		expect(new Set(requests.map((span) => span.traceId)).size).toBe(2);
		for (const span of requests) {
			expect(span.parent).toEqual(Option.none());
			expect(span.traceId).not.toBe(storySpan.traceId);
			expect(span.status._tag).toBe("Ended");
			expect(spans.find((child) => child.name === "request work" && child.traceId === span.traceId)?.parent).toEqual(Option.some(span));
		}
		for (const name of ["story trait", "story step"]) {
			expect(spans.find((span) => span.name === name)?.parent).toEqual(Option.some(storySpan));
		}
		expect((yield* Effect.currentSpan).spanId).toBe(storySpan.spanId);
		expect(story.lines).toEqual(["the application is ready", "a caller sends a request", "a caller sends a request", "the engine takes a step"]);
	},
);

tracingApp.it("a request continues only the trace context in its headers", [], function* ({ request, spans }) {
	const traceId = "1234567890abcdef1234567890abcdef";
	const spanId = "1234567890abcdef";
	expect(yield* request({ traceparent: `00-${traceId}-${spanId}-01` })).toBe("ok");
	const requestSpan = spans.find((span) => span.kind === "server");
	expect(requestSpan?.traceId).toBe(traceId);
	expect(Option.getOrUndefined(requestSpan?.parent ?? Option.none())).toMatchObject({ spanId, traceId });
	expect(requestSpan?.traceId).not.toBe((yield* Effect.currentSpan).traceId);
});
