import { Tracer } from "effect";

export function recordingTracer() {
	const spans: Tracer.NativeSpan[] = [];
	return {
		spans,
		tracer: Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		}),
	};
}
