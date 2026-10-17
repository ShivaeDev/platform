import { Effect, Option } from "effect";
import { expect } from "vitest";
import { afterTracingApp } from "#test/afterTracingApp.ts";

afterTracingApp.it("hosts booted after deployment start independent request traces", [], function* ({ request, spans }) {
	const storySpan = yield* Effect.currentSpan;
	expect(yield* request()).toBe("ok");
	expect(yield* request()).toBe("ok");
	const requests = spans.filter((span) => span.kind === "server");
	expect(requests).toHaveLength(2);
	expect(new Set(requests.map((span) => span.traceId)).size).toBe(2);
	for (const span of requests) {
		expect(span.parent).toEqual(Option.none());
		expect(span.traceId).not.toBe(storySpan.traceId);
		expect(span.status._tag).toBe("Ended");
		expect(spans.find((child) => child.name === "request work" && child.traceId === span.traceId)?.parent).toEqual(Option.some(span));
	}
	expect(spans.filter((span) => span.name === "request verb").map((span) => span.parent)).toEqual([Option.some(storySpan), Option.some(storySpan)]);
	expect(yield* Effect.currentSpan).toBe(storySpan);
});

afterTracingApp.it("creation and every after hook boot outside the story trace", [], function* ({ spans }) {
	const storySpan = yield* Effect.currentSpan;
	for (const name of ["engine startup", "host startup", "host ready", "ready ensuring"]) {
		const span = spans.find((candidate) => candidate.name === name);
		expect(span).toBeDefined();
		expect(span?.parent).toEqual(Option.none());
		expect(span?.traceId).not.toBe(storySpan.traceId);
	}
});

afterTracingApp.it("hook finalizers and teardown retain their detached context", [], function* ({ spans }, context) {
	const storySpan = yield* Effect.currentSpan;
	context.onTestFinished(() => {
		for (const name of ["engine finalizer", "deployment finalizer", "ready finalizer", "host teardown"]) {
			const span = spans.find((candidate) => candidate.name === name);
			expect(span).toBeDefined();
			expect(span?.parent).toEqual(Option.none());
			expect(span?.traceId).not.toBe(storySpan.traceId);
			expect(span?.status._tag).toBe("Ended");
		}
	});
});
