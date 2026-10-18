import { Effect, Exit, Layer, ManagedRuntime, Scope, Tracer } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";
import { otlpReceiver } from "#otlpReceiver.ts";
import { storyKit } from "#storyKit.ts";

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
			return { receiver, runtime };
		},
		name: protobuf ? "protobuf traces" : "JSON traces",
		stages: ["ready"],
		verbs: ({ receiver, runtime }, story) => ({
			failWork: () => Effect.promise(() => runtime.runPromise(Effect.fail("failed work").pipe(Effect.withSpan("failed"), Effect.ignore))),
			flushExporter: () => Effect.promise(() => runtime.dispose()),
			requests: receiver.requests,
			runWork: () =>
				Effect.promise(() => {
					story.tell("the application runs traced work");
					return runtime.runPromise(exportWork);
				}),
			spans: receiver.spans,
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
	verbs: ({ receiver, scope }) => ({
		close: () => Scope.close(scope, Exit.void),
		requests: receiver.requests,
		send: (path: string, contentType: string, body: Buffer) =>
			Effect.promise(async () => {
				const response = await fetch(`${receiver.url}${path}`, {
					body: Uint8Array.from(body),
					headers: { "content-type": contentType },
					method: "POST",
				});
				await response.arrayBuffer();
				return response.status;
			}),
		url: () => receiver.url,
	}),
});
