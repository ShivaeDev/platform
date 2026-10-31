import { Cause, Effect, Queue, Stream } from "effect";

export function recordedSignals<A, E = never>() {
	const values: A[] = [];
	const subscribers = new Set<Queue.Queue<A, E | Cause.Done>>();
	let ended = false;
	let failure: E | undefined;
	function finish(queue: Queue.Queue<A, E | Cause.Done>) {
		if (failure === undefined) {
			Queue.endUnsafe(queue);
		} else {
			Queue.failCauseUnsafe(queue, Cause.fail(failure));
		}
	}
	return {
		end: (error?: E) => {
			ended = true;
			failure = error;
			for (const queue of subscribers) {
				finish(queue);
			}
		},
		push: (value: A) => {
			values.push(value);
			for (const queue of subscribers) {
				Queue.offerUnsafe(queue, value);
			}
		},
		stream: Stream.callback<A, E>((queue) =>
			Effect.gen(function* () {
				for (const value of values) {
					Queue.offerUnsafe(queue, value);
				}
				if (ended) {
					finish(queue);
				} else {
					subscribers.add(queue);
					yield* Effect.addFinalizer(() => Effect.sync(() => subscribers.delete(queue)));
				}
			}),
		),
		values,
	};
}
