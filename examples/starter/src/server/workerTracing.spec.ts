import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { app, signedIn } from "#test-support/application.ts";
import { otlpReceiver } from "#test-support/otlpReceiver.ts";

app.it(
	"exports the worker's Effect job spans with the configured service name",
	[signedIn()],
	function* ({ actor, startWorker }) {
		const receiver = yield* Effect.acquireRelease(
			Effect.promise(() => otlpReceiver()),
			(collector) => Effect.promise(() => collector.close()),
		);
		const note = yield* actor().notes.create({ title: "Count these words" });
		yield* startWorker({ "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": `${receiver.url}/v1/traces`, "OTEL_SERVICE_NAME": "worker-test" });
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(sql`select "wordCount" from starter_notes where id = ${note.id}`)).toEqual([{ wordCount: 3 }]);
					expect(receiver.requests.some((request) => request.body.includes('"name":"CountWords"'))).toBe(true);
				},
				{ timeout: 8000 },
			),
		);
		const body = receiver.requests.map((request) => request.body).join("\n");
		expect(body).toContain('"key":"service.name","value":{"stringValue":"worker-test"}');
		expect(body).not.toContain("starter-test-secret");
	},
	15_000,
);

app.it(
	"completes a worker job and shuts down when the collector is down",
	[signedIn()],
	function* ({ actor, startWorker }) {
		const receiver = yield* Effect.promise(() => otlpReceiver());
		yield* Effect.promise(() => receiver.close());
		const note = yield* actor().notes.create({ title: "Collector is down" });
		yield* startWorker({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(sql`select "wordCount" from starter_notes where id = ${note.id}`)).toEqual([{ wordCount: 3 }]);
					expect(await Effect.runPromise(sql`select state from pgboss.job where name = 'count-note-words'`)).toEqual([{ state: "completed" }]);
				},
				{ timeout: 5000 },
			),
		);
	},
	15_000,
);
