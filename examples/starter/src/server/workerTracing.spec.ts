import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	app.it(
		`counts a note and exports worker spans with service metadata over ${protocol}`,
		[signedIn()],
		function* ({ actor, collector, wordCountCompletions }) {
			const receiver = yield* collector();
			const note = yield* actor().notes.create({ title: "Count these words" });
			const stopWorker = yield* receiver.startWorker(protocol);
			yield* Effect.promise(() =>
				expect.poll(() => Effect.runPromise(actor().notes.get({ id: note.id })), { timeout: 8000 }).toEqual({ ...note, version: 1, wordCount: 3 }),
			);
			yield* stopWorker;
			expect(yield* wordCountCompletions()).toEqual([{ id: expect.any(String), retryCount: 0 }]);
			expect(receiver.spans.some((span) => span.name === "CountWords")).toBe(true);
			expect(receiver.requests).toContainEqual(
				expect.objectContaining({ headers: expect.objectContaining({ "x-collector-token": "worker collector secret" }), path: "/v1/traces" }),
			);
			expect(receiver.spans.find((span) => span.name === "CountWords")?.resourceAttributes).toEqual(
				expect.arrayContaining([
					{ key: "service.name", value: { stringValue: "worker-test" } },
					{ key: "deployment.environment", value: { stringValue: "worker-test" } },
				]),
			);
			for (const secret of ["worker collector secret", "app-test-secret"]) {
				expect(receiver.requests.every(({ body }) => !body.includes(Buffer.from(secret)))).toBe(true);
			}
		},
		15_000,
	);
}

for (const status of ["down", 500] as const) {
	app.it(
		`completes a worker job and shuts down when the collector ${status === "down" ? "is down" : "returns HTTP 500"}`,
		[signedIn()],
		function* ({ actor, collector, wordCountCompletions }) {
			const receiver = yield* collector(status);
			const note = yield* actor().notes.create({ title: "Collector has failed" });
			const stopWorker = yield* receiver.startWorker();
			yield* Effect.promise(() =>
				expect.poll(() => Effect.runPromise(actor().notes.get({ id: note.id })), { timeout: 8000 }).toEqual({ ...note, version: 1, wordCount: 3 }),
			);
			yield* Effect.promise(() =>
				expect.poll(() => Effect.runPromise(wordCountCompletions()), { timeout: 8000 }).toEqual([{ id: expect.any(String), retryCount: 0 }]),
			);
			yield* stopWorker;
			expect(yield* wordCountCompletions()).toEqual([{ id: expect.any(String), retryCount: 0 }]);
			if (status !== "down") {
				expect(receiver.requests.length).toBeGreaterThan(0);
			}
		},
		15_000,
	);
}
