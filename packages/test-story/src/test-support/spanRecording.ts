import { Context, Tracer } from "effect";

export function recording() {
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	return { spans, tracer };
}

export class Recording extends Context.Service<Recording, ReturnType<typeof recording>>()("tracingApp/Recording") {}
