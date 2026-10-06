import { Effect, PubSub, Stream } from "effect";
import type { LiveHint } from "@shivaedev/effect-contract/live.ts";
import type { Change, Changes } from "#files/changes.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { affected } from "./affected.ts";

export function hints(changes: Changes, index: Effect.Effect<Snapshot, unknown>) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const subscription = yield* PubSub.subscribe(changes.events);
			let sequence = changes.sequence ? yield* changes.sequence : undefined;
			let previous = yield* Effect.option(index);
			function nextHint(change: Change) {
				return Effect.gen(function* () {
					const current = yield* Effect.option(index);
					const contiguous = sequence !== undefined && change.sequence === sequence + 1;
					sequence = change.sequence;
					let hint: LiveHint = { _tag: "Resync" };
					if (contiguous && change._tag === "Changed" && previous._tag === "Some" && current._tag === "Some") {
						const keys = affected(previous.value.model, current.value.model, change.paths);
						if (keys !== undefined) {
							hint = { _tag: "Changed", keys };
						}
					}
					previous = current;
					return hint;
				});
			}

			const changesStream = Stream.fromSubscription(subscription).pipe(Stream.mapEffect(nextHint));
			return Stream.concat(Stream.succeed<LiveHint>({ _tag: "Resync" }), changesStream);
		}),
	);
}
