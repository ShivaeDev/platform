import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Exit, Layer, Logger, Redacted, Scope } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization } from "effect/observability";
import { Reactivity } from "effect/reactivity";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { otlpReceiver } from "#server/otlpReceiver.ts";
import { storyKit } from "#server/storyKit.ts";
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

function failedStatus(operation: string, message?: string, service?: string) {
	const span = { name: operation, spanId: "1234567890abcdef", status: { code: 2, message }, traceId: "1234567890abcdef1234567890abcdef" };
	return {
		resourceSpans: [
			{
				resource: { attributes: service === undefined ? [] : [{ key: "service.name", value: { stringValue: service } }] },
				scopeSpans: [{ spans: [span] }],
			},
		],
	};
}

const untracedLogEvents = Effect.fnUntraced(function* () {
	const { spans, tracer } = recording();
	yield* Effect.logInfo("outside tracing").pipe(Effect.withSpan("surrounding story"), Effect.withTracer(tracer));
	return spans.flatMap((span) => span.events.map(([name]) => name));
});

export function otlpReadoutApp(protobuf: boolean, immediate = false, postgres = false) {
	return storyKit({
		clock: "test",
		*create() {
			const receiver = yield* otlpReceiver();
			const scope = yield* Scope.fork(yield* Scope.Scope);
			function tracing(serviceName: string) {
				return Layer.build(
					receiver
						.tracerLayer({ exportInterval: "1 hour", maxBatchSize: immediate ? 1 : 1000, resource: { serviceName } })
						.pipe(Layer.provide(protobuf ? OtlpSerialization.layerProtobuf : OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
				).pipe(Scope.provide(scope));
			}
			const contexts = { "document-worker": yield* tracing("document-worker"), "story-readouts": yield* tracing("story-readouts") };
			const sql = postgres
				? yield* PgClient.makeClient({ url: yield* Config.Redacted("PLATFORM_TEST_SQL_TEST_DATABASE_URL") }).pipe(Effect.provide(Reactivity.layer))
				: undefined;
			return { contexts, receiver, scope, sql };
		},
		inspect: ({ receiver }) => ({ errors: receiver.errors(), queries: receiver.queries(), spans: receiver.spans.map(({ name }) => name) }),
		layer: Logger.layer([]),
		name: `${protobuf ? "protobuf" : "JSON"} telemetry${immediate ? " in flight" : ""}`,
		runIf: !postgres || database.configured,
		stages: [],
		verbs: ({ contexts, receiver, scope, sql }, story) => {
			function run<A, E>(action: Effect.Effect<A, E>, service: keyof typeof contexts = "story-readouts") {
				return action.pipe(Effect.provide(contexts[service]));
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
				reports: (message: string, service?: keyof typeof contexts) =>
					run(Effect.fail(new Error(message)).pipe(Effect.withSpan("save document"), Effect.ignore), service),
				reportsStatus: (operation: string, message?: string, service?: string) => postExport(receiver.url, failedStatus(operation, message, service)),
				runQuery: () => run(sql === undefined ? Effect.die("This story needs a PostgreSQL client.") : sql`SELECT 'story query' AS title`),
				tracedLogs: () => Effect.sync(() => receiver.spans.flatMap((span) => span.events.map(({ name }) => name))),
				tracesForm: (body: string) => run(Effect.annotateCurrentSpan("http.request.body", body).pipe(Effect.withSpan("submit form"))),
				tracesLegacyQuery: (query: string) => run(Effect.annotateCurrentSpan("db.statement", query).pipe(Effect.withSpan("legacy query"))),
				tracesSecret: (secret: string, redacted: boolean) =>
					run(Effect.annotateCurrentSpan("secret", redacted ? Redacted.make(secret) : secret).pipe(Effect.withSpan("secret handling"))),
				tracesSecretEvent: (secret: string) =>
					run(Effect.flatMap(Effect.currentSpan, (span) => Effect.sync(() => span.event(secret, 0n))).pipe(Effect.withSpan("secret event"))),
				tracesUrl: (url: string) => run(Effect.annotateCurrentSpan("url.full", url).pipe(Effect.withSpan("send request"))),
				untracedLogEvents,
			};
		},
	});
}
