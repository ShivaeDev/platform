import { Effect, Tracer } from "effect";

export function boardReadCounts() {
	const passes = { completed: 0, live: 0, peak: 0, started: 0 };
	const documents = { completed: 0, live: 0, peak: 0, started: 0 };
	let reconciles = 0;
	let cycles = 0;
	const counters = new Map([
		["FleetBoard.readDocuments", passes],
		["FleetBoard.readDocument", documents],
	]);
	const tracer = Tracer.make({
		span(options) {
			const span = new Tracer.NativeSpan(options);
			const counter = counters.get(options.name);
			if (counter !== undefined) {
				counter.started += 1;
				counter.live += 1;
				counter.peak = Math.max(counter.peak, counter.live);
			}
			const end = span.end.bind(span);
			span.end = (...args) => {
				if (counter !== undefined) {
					counter.live -= 1;
					counter.completed += 1;
				}
				if (options.name === "Fleet.reconcile") {
					reconciles += 1;
				}
				if (options.name === "FleetHost.admitApproved") {
					cycles += 1;
				}
				return end(...args);
			};
			return span;
		},
	});
	return {
		observe: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.withTracer(effect, tracer),
		snapshot: () => ({ cycles, documents: { ...documents }, passes: { ...passes }, reconciles }),
	};
}
