import { Effect, Stream } from "effect";
import type { SubscriptionEvent } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export function liveAttempt<E, R>(
	stream: Stream.Stream<SubscriptionEvent, E, R>,
	observe: {
		readonly denied: (denial: QueryReadDenied) => void;
		readonly delivered: () => void;
		readonly paused: () => boolean;
		readonly queued: () => void;
	},
) {
	return stream.pipe(
		Stream.runForEach((event) =>
			Effect.sync(() => {
				if (event._tag === "QueryReadDenied") {
					observe.denied(event);
				} else if (observe.paused()) {
					observe.queued();
				} else {
					observe.delivered();
				}
			}),
		),
		Effect.scoped,
	);
}
