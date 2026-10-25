import { Effect, Tracer } from "effect";

export function spanCounts() {
	const counts = new Map<string, number>();
	const spans: string[] = [];
	const tracer = Tracer.make({
		span(options) {
			spans.push(options.name);
			counts.set(options.name, (counts.get(options.name) ?? 0) + 1);
			return new Tracer.NativeSpan(options);
		},
	});
	return {
		count: (name: string) => counts.get(name) ?? 0,
		names: () => [...spans],
		reset: () => {
			counts.clear();
			spans.length = 0;
		},
		trace: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.withTracer(effect, tracer),
	};
}
