import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { SubscriptionHint } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export function liveAttempt<E, R>(
	stream: Stream.Stream<SubscriptionHint, E, R>,
	observe: {
		readonly changed: (keys: readonly Key[]) => void;
		readonly denied: (denial: QueryReadDenied) => void;
		readonly live: () => void;
		readonly paused: () => boolean;
		readonly queued: () => void;
		readonly reconcile: (connected: boolean) => void;
	},
) {
	let connected = false;
	return Effect.suspend(() => {
		let first = true;
		return stream.pipe(
			Stream.runForEach((hint) =>
				Effect.sync(() => {
					if (hint._tag === "QueryReadDenied") {
						observe.denied(hint);
						connected = true;
						first = true;
						return;
					}
					observe.live();
					if (observe.paused()) {
						observe.queued();
					} else if (first || hint._tag === "Resync") {
						observe.reconcile(connected);
					} else {
						observe.changed(hint.keys);
					}
					connected = true;
					first = false;
				}),
			),
			Effect.scoped,
		);
	});
}
