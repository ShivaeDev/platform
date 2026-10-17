import { Effect, Exit, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { otlpReceiver } from "@shivaedev/test-story/otlpReceiver.ts";
import { app, signedIn } from "#test-support/application.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	app.it(
		`exports the worker's Effect job spans with the configured service name over ${protocol}`,
		[signedIn()],
		function* ({ actor, startWorker }) {
			const receiver = yield* otlpReceiver();
			const note = yield* actor().notes.create({ title: "Count these words" });
			const stopWorker = yield* startWorker({
				"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=worker%20collector%20secret",
				"OTEL_EXPORTER_OTLP_PROTOCOL": protocol,
				"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": `${receiver.url}/v1/traces`,
				"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=worker-test",
				"OTEL_SERVICE_NAME": "worker-test",
			});
			const sql = yield* SqlClient.SqlClient;
			yield* Effect.promise(() =>
				vi.waitFor(
					async () => {
						expect(await Effect.runPromise(sql`select "wordCount" from notes where id = ${note.id}`)).toEqual([{ wordCount: 3 }]);
					},
					{ timeout: 8000 },
				),
			);
			yield* stopWorker;
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

for (const status of [undefined, 500]) {
	app.it(
		`completes a worker job and shuts down when the collector ${status === undefined ? "is down" : "returns HTTP 500"}`,
		[signedIn()],
		function* ({ actor, startWorker }) {
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const receiver = yield* otlpReceiver({ status: status ?? 200 }).pipe(Scope.provide(scope));
			if (status === undefined) {
				yield* Scope.close(scope, Exit.void);
			}
			const note = yield* actor().notes.create({ title: "Collector has failed" });
			const stopWorker = yield* startWorker({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
			const sql = yield* SqlClient.SqlClient;
			yield* Effect.promise(() =>
				vi.waitFor(
					async () => {
						expect(await Effect.runPromise(sql`select "wordCount" from notes where id = ${note.id}`)).toEqual([{ wordCount: 3 }]);
						expect(await Effect.runPromise(sql`select state from pgboss.job where name = 'count-note-words'`)).toEqual([{ state: "completed" }]);
					},
					{ timeout: 8000 },
				),
			);
			yield* stopWorker;
			if (status !== undefined) {
				expect(receiver.requests.length).toBeGreaterThan(0);
			}
		},
		15_000,
	);
}
