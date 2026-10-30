import { Effect, Exit, Layer, ManagedRuntime, Scope, Tracer } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";
import { type OtlpSpan, otlpReceiver } from "#otlpReceiver.ts";
import { storyKit } from "#storyKit.ts";
import { bytesInWords } from "./httpClient.ts";

const exportWork = Effect.gen(function* () {
	const parent = yield* Effect.currentSpan;
	const child = yield* Effect.gen(function* () {
		const span = yield* Effect.currentSpan;
		span.event("received", 123n, { detail: "event value" });
		span.addLinks([
			{
				attributes: { detail: "link value" },
				span: Tracer.externalSpan({ spanId: "1234567890abcdef", traceId: "1234567890abcdef1234567890abcdef" }),
			},
		]);
		yield* Effect.annotateCurrentSpan({
			count: 42,
			flag: true,
			fractional: 1.5,
			negative: -12,
			nested: { a: "b" },
			planted: "raw-export-secret",
			tags: ["one", "two"],
		});
		return { parentSpanId: parent.spanId, spanId: span.spanId, traceId: span.traceId };
	}).pipe(Effect.withSpan("child", { kind: "client" }));
	return child;
}).pipe(Effect.withSpan("parent"));

interface TracedIds {
	readonly parentSpanId: string;
	readonly spanId: string;
	readonly traceId: string;
}

function exported(receiver: { readonly spans: readonly OtlpSpan[] }, name: string) {
	const span = receiver.spans.find((candidate) => candidate.name === name);
	if (span === undefined) {
		throw new Error(`The receiver has no span named "${name}".`);
	}
	return span;
}

export function otlpApp(protobuf: boolean) {
	return storyKit({
		clock: "live",
		*create() {
			const receiver = yield* otlpReceiver();
			const runtime = ManagedRuntime.make(
				OtlpTracer.layer({
					exportInterval: "1 hour",
					headers: { "x-collector-token": "collector secret" },
					maxBatchSize: 1,
					resource: { serviceName: "story-exporter" },
					url: `${receiver.url}/v1/traces`,
				}).pipe(Layer.provide(protobuf ? OtlpSerialization.layerProtobuf : OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
			);
			yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
			const traced: { ids: TracedIds | undefined } = { ids: undefined };
			return { receiver, runtime, traced };
		},
		inspect: ({ receiver }) => receiver.spans.map(({ name }) => name),
		name: protobuf ? "protobuf traces" : "JSON traces",
		stages: ["ready"],
		verbs: ({ receiver, runtime, traced }, story) => ({
			exportedSpan: (name: string) => Effect.sync(() => exported(receiver, name)),
			exportedSpanIds: (name: string) =>
				Effect.sync(() => {
					const { parentSpanId, spanId, traceId } = exported(receiver, name);
					return { parentSpanId, spanId, traceId };
				}),
			exportedSpanNames: () => Effect.sync(() => receiver.spans.map(({ name }) => name).sort()),
			exportRequests: () =>
				Effect.sync(() =>
					receiver.requests.map(({ headers, path }) => `${path} as ${headers["content-type"]} with token "${headers["x-collector-token"]}"`),
				),
			exportsCarrying: (text: string) => Effect.sync(() => receiver.requests.filter(({ body }) => body.includes(Buffer.from(text))).length),
			exportsItsWork: () =>
				Effect.promise(async () => {
					story.tell("the application traces work, traces a failure and shuts down its runtime");
					traced.ids = await runtime.runPromise(exportWork);
					await runtime.runPromise(Effect.fail("failed work").pipe(Effect.withSpan("failed"), Effect.ignore));
					await runtime.dispose();
				}),
			tracedIds: () => Effect.sync(() => traced.ids),
		}),
	});
}

export const lifecycle = storyKit({
	clock: "live",
	*create() {
		const scope = yield* Scope.fork(yield* Scope.Scope);
		const receiver = yield* otlpReceiver().pipe(Effect.provideService(Scope.Scope, scope));
		return { receiver, scope };
	},
	name: "receiver scope",
	stages: ["ready"],
	verbs: ({ receiver, scope }, story) => ({
		closesReceiver: () => {
			story.tell("the receiver's scope closes");
			return Scope.close(scope, Exit.void);
		},
		received: () =>
			Effect.sync(() => receiver.requests.map(({ body, headers, path }) => `${path} as ${headers["content-type"]}: ${bytesInWords(body)}`)),
		sends: (path: string, contentType: string, body: Buffer) =>
			Effect.promise(() =>
				fetch(`${receiver.url}${path}`, { body: Uint8Array.from(body), headers: { "content-type": contentType }, method: "POST" }).then(
					async (response) => {
						await response.arrayBuffer();
						return `HTTP ${response.status}`;
					},
					() => "connection refused",
				),
			),
	}),
});
