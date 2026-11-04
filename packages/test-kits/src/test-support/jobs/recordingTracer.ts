import { Deferred, Effect, Tracer } from "effect";

export function recordingTracer() {
	const spans: Tracer.NativeSpan[] = [];
	const completions: { readonly span: Tracer.NativeSpan; readonly ended: Deferred.Deferred<void> }[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			const ended = Deferred.makeUnsafe<void>();
			const end = span.end.bind(span);
			span.end = (time, exit) => {
				end(time, exit);
				Deferred.doneUnsafe(ended, Effect.void);
			};
			spans.push(span);
			completions.push({ ended, span });
			return span;
		},
	});
	return {
		spans,
		tracer,
		whenSpanEnds: (matches: (span: Tracer.NativeSpan) => boolean) =>
			Effect.suspend(() => {
				const completion = completions.find(({ span }) => matches(span));
				return completion === undefined ? Effect.die(new Error("No matching span was recorded")) : Deferred.await(completion.ended);
			}),
	};
}
