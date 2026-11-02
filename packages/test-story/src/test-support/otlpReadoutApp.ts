import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Exit, Layer, Logger, Redacted, Scope } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization } from "effect/observability";
import { Reactivity } from "effect/reactivity";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { otlpReceiver } from "#otlpReceiver.ts";
import { storyKit } from "#storyKit.ts";
import { recording } from "./spanRecording.ts";

const database = postgresTestUrl("PLATFORM_TEST_SQL_TEST_DATABASE_URL");

function postExport(url: string, payload: object) {
	return Effect.promise(async () => {
		const response = await fetch(`${url}/v1/traces`, {
			body: JSON.stringify(payload),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		await response.arrayBuffer();
	});
}

function failedStatus(operation: string, message?: string) {
	const span = { name: operation, spanId: "1234567890abcdef", status: { code: 2, message }, traceId: "1234567890abcdef1234567890abcdef" };
	return { resourceSpans: [{ scopeSpans: [{ spans: [span] }] }] };
}

const untracedLogEvents = Effect.fnUntraced(function* () {
	const { spans, tracer } = recording();
	yield* Effect.logInfo("outside tracing").pipe(Effect.withSpan("surrounding story"), Effect.withTracer(tracer));
	return spans.flatMap((span) => span.events.map(([name]) => name));
});

export function otlpReadoutApp(protobuf: boolean, immediate = false, postgres = false) {
	return storyKit({
		clock: "live",
		*create() {
			const receiver = yield* otlpReceiver();
			const scope = yield* Scope.fork(yield* Scope.Scope);
			const context = yield* Layer.build(
				receiver
					.tracerLayer({ exportInterval: "1 hour", maxBatchSize: immediate ? 1 : 1000, resource: { serviceName: "story-readouts" } })
					.pipe(Layer.provide(protobuf ? OtlpSerialization.layerProtobuf : OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
			).pipe(Scope.provide(scope));
			const sql = postgres
				? yield* PgClient.makeClient({ url: yield* Config.Redacted("PLATFORM_TEST_SQL_TEST_DATABASE_URL") }).pipe(Effect.provide(Reactivity.layer))
				: undefined;
			return { context, receiver, scope, sql };
		},
		inspect: ({ receiver }) => ({ errors: receiver.errors(), queries: receiver.queries(), spans: receiver.spans.map(({ name }) => name) }),
		layer: Logger.layer([]),
		name: `${protobuf ? "protobuf" : "JSON"} telemetry${immediate ? " in flight" : ""}`,
		runIf: !postgres || database.configured,
		stages: [],
		verbs: ({ context, receiver, scope, sql }, story) => {
			function run<A, E>(action: Effect.Effect<A, E>) {
				return action.pipe(Effect.provide(context));
			}
			return {
				closesTracing: () => Scope.close(scope, Exit.void),
				errors: () => Effect.sync(receiver.errors),
				exportsMetadata: (metadata: Record<string, string>) => postExport(receiver.url, { metadata }),
				exportsSecret: (secret: string) => Effect.sync(() => receiver.exportsSecret(secret)),
				flush: () => {
					story.tell("pending telemetry reaches the receiver");
					return receiver.flush;
				},
				logs: (message: string) => run(Effect.logInfo(message).pipe(Effect.withSpan("application log"))),
				queries: () => Effect.sync(receiver.queries),
				reports: (message: string) => run(Effect.fail(new Error(message)).pipe(Effect.withSpan("save document"), Effect.ignore)),
				reportsStatus: (operation: string, message?: string) => postExport(receiver.url, failedStatus(operation, message)),
				runQuery: () => run(sql === undefined ? Effect.die("This story needs a PostgreSQL client.") : sql`SELECT 'story query' AS title`),
				tracedLogs: () => Effect.sync(() => receiver.spans.flatMap((span) => span.events.map(({ name }) => name))),
				tracesLegacyQuery: (query: string) => run(Effect.annotateCurrentSpan("db.statement", query).pipe(Effect.withSpan("legacy query"))),
				tracesSecret: (secret: string, redacted: boolean) =>
					run(Effect.annotateCurrentSpan("secret", redacted ? Redacted.make(secret) : secret).pipe(Effect.withSpan("secret handling"))),
				tracesSecretEvent: (secret: string) =>
					run(Effect.flatMap(Effect.currentSpan, (span) => Effect.sync(() => span.event(secret, 0n))).pipe(Effect.withSpan("secret event"))),
				untracedLogEvents,
			};
		},
	});
}
