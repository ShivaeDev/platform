import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { OtlpExporter, OtlpTracer } from "effect/observability";
import * as Stream from "effect/Stream";
import * as Tracer from "effect/Tracer";
import type { OtlpSpan, OtlpTracerOptions } from "#server/otlpReceiver.ts";

export function otlpTracing(url: string, received: Stream.Stream<OtlpSpan>) {
	const ended = new Set<string>();
	const flushers = new Set<OtlpExporter.Flusher["Service"]>();
	return {
		flush: Effect.gen(function* () {
			const pending = new Set(ended);
			yield* Effect.forEach(flushers, (flusher) => flusher.flush, { discard: true });
			if (pending.size > 0) {
				yield* Stream.runForEachWhile(received, (span) =>
					Effect.sync(() => {
						pending.delete(span.spanId);
						return pending.size > 0;
					}),
				);
			}
		}),
		tracerLayer: (options: OtlpTracerOptions = {}) => makeTracerLayer(url, ended, flushers, options),
	};
}

function makeTracerLayer(url: string, ended: Set<string>, flushers: Set<OtlpExporter.Flusher["Service"]>, options: OtlpTracerOptions) {
	return Layer.effect(
		Tracer.Tracer,
		Effect.gen(function* () {
			const flusher = yield* OtlpExporter.Flusher;
			yield* Effect.acquireRelease(
				Effect.sync(() => flushers.add(flusher)),
				() => Effect.sync(() => flushers.delete(flusher)),
			);
			const tracer = yield* OtlpTracer.make({ ...options, url });
			return Tracer.make({
				context: tracer.context,
				span: (spanOptions) => {
					const span = tracer.span(spanOptions);
					const end = span.end.bind(span);
					span.end = (time, exit) => {
						end(time, exit);
						if (span.sampled) {
							ended.add(span.spanId);
						}
					};
					return span;
				},
			});
		}),
	).pipe(Layer.provideMerge(OtlpExporter.layerFlusher), Layer.merge(Logger.layer([Logger.tracerLogger], { mergeWithExisting: true })));
}
