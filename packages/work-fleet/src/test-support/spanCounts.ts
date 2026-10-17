import { Effect, Tracer } from "effect";

export function spanCounts() {
	const counts = new Map<string, number>();
	const tracer = Tracer.make({
		span(options) {
			counts.set(options.name, (counts.get(options.name) ?? 0) + 1);
			return new Tracer.NativeSpan(options);
		},
	});
	return {
		count: (name: string) => counts.get(name) ?? 0,
		reset: () => counts.clear(),
		trace: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.withTracer(effect, tracer),
	};
}
