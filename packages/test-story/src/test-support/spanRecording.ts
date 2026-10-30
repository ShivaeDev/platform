import { Context, Effect, Option, Tracer } from "effect";

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

export function tracedAsTheStory<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(Effect.service(Recording), ({ spans, tracer }) => {
		spans.length = 0;
		return effect.pipe(Effect.withSpan("story"), Effect.withTracer(tracer));
	});
}

export function describeSpan(span: Tracer.NativeSpan): string {
	const status = span.status._tag === "Ended" ? "ended" : "still open";
	if (Option.isNone(span.parent)) {
		return `a root span, ${status}`;
	}
	const parent = span.parent.value;
	if (parent._tag === "ExternalSpan") {
		return `under external span ${parent.spanId} in trace ${parent.traceId}, ${status}`;
	}
	return `under "${parent.name}", ${status}`;
}

export function spanReadouts(spans: readonly Tracer.NativeSpan[]) {
	return {
		serverSpans: () => Effect.sync(() => spans.filter((span) => span.kind === "server").map(describeSpan)),
		spansNamed: (name: string) => Effect.sync(() => spans.filter((span) => span.name === name).map(describeSpan)),
	};
}
