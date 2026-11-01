import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { OtlpExporter, OtlpTracer } from "effect/observability";
import * as Stream from "effect/Stream";
import * as Tracer from "effect/Tracer";
import type { OtlpSpan, OtlpTracerOptions } from "#otlpReceiver.ts";

function recordEnds(tracer: Tracer.Tracer, ended: Set<string>) {
	return Tracer.make({
		context: tracer.context,
		span: (options) => {
			const span = tracer.span(options);
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
}

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
		tracerLayer: (options: OtlpTracerOptions = {}) =>
			Layer.effect(
				Tracer.Tracer,
				Effect.gen(function* () {
					const flusher = yield* OtlpExporter.Flusher;
					yield* Effect.acquireRelease(
						Effect.sync(() => flushers.add(flusher)),
						() => Effect.sync(() => flushers.delete(flusher)),
					);
					const tracer = yield* OtlpTracer.make({ ...options, url });
					return recordEnds(tracer, ended);
				}),
			).pipe(Layer.provideMerge(OtlpExporter.layerFlusher), Layer.merge(Logger.layer([Logger.tracerLogger], { mergeWithExisting: true }))),
	};
}
