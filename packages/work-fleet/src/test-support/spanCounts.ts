import { Effect, Tracer } from "effect";

export function spanCounts() {
	const counts = new Map<string, number>();
	const recorded: string[] = [];
	const tracer = Tracer.make({
		span(options) {
			counts.set(options.name, (counts.get(options.name) ?? 0) + 1);
			recorded.push(options.name);
			return new Tracer.NativeSpan(options);
		},
	});
	return {
		count: (name: string) => counts.get(name) ?? 0,
		recorded: (name: string) => recorded.filter((entry) => entry === name),
		reset: () => {
			counts.clear();
			recorded.length = 0;
		},
		trace: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.withTracer(effect, tracer),
	};
}
