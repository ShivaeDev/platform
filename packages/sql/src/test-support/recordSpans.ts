import { Effect, Tracer } from "effect";

export function recordSpans() {
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	return {
		observe: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.withTracer(tracer)),
		spans,
	};
}
