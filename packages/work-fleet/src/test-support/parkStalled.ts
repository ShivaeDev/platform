import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export function stalledProgress(observation: SessionObservation): SessionObservation {
	return { ...observation, progress: [{ id: "unchanged" }] };
}

export function stalledTransport(transport: typeof SessionTransport.Service): typeof SessionTransport.Service {
	const interrupted = new Set<string>();
	return {
		...transport,
		interrupt: (receipt) =>
			Effect.sync(() => {
				interrupted.add(receipt.turnId);
				return receipt;
			}),
		observe: (receipt) =>
			transport.observe(receipt).pipe(
				Effect.map((observation) =>
					stalledProgress({
						...observation,
						execution: interrupted.has(receipt.turnId) ? "interrupted" : observation.execution,
					}),
				),
			),
	};
}

export const parkStalled = Effect.fnUntraced(function* (advance: () => void) {
	const fleet = yield* Fleet;
	yield* fleet.reconcile("one");
	advance();
	yield* fleet.reconcile("one");
	return yield* fleet.get("one");
});
