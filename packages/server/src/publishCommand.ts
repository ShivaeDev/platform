import { Effect, identity, Option, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { CommandPublication, type CommandPublicationError } from "@shivaedev/changes/commandPublication.ts";
import { SyncDelivery, type SyncToken } from "@shivaedev/changes/syncToken.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";

const recoverPublication = Effect.fnUntraced(function* (cause: CommandPublicationError) {
	yield* Effect.logError("Committed command invalidation failed; resynchronizing live streams", cause);
	const publication = yield* CommandPublication;
	yield* publication.recover.pipe(
		Effect.catch((error) => Effect.logError("Committed command Resync broadcast failed; other hosts may remain stale", error)),
	);
});

export function publishCommand<A, E, R>(effect: Effect.Effect<A, E, R>, declaredKeys: (result: A) => readonly unknown[], sync?: SyncToken) {
	return Effect.uninterruptibleMask((restore) =>
		Effect.gen(function* () {
			const reactivity = yield* Effect.serviceOption(Reactivity.Reactivity);
			if (Option.isNone(reactivity)) {
				return yield* restore(effect);
			}
			const published = new Set<unknown>();
			const observer = yield* ChangeObserver;
			const result = yield* restore(effect).pipe(
				Effect.provideService(ChangeObserver, (event) => {
					if (event._tag === "Published") {
						for (const key of event.changes) {
							published.add(key);
						}
					}
					return observer(event);
				}),
			);
			const keys = declaredKeys(result).filter((key) => !published.has(key));
			if (keys.length > 0 || sync !== undefined) {
				const publication = yield* CommandPublication;
				const live = yield* Effect.serviceOption(LiveServer);
				// The token leaves after the handler's last commit and behind the declared keys, so a stream that passes it has applied them all.
				yield* publication
					.publish(keys, sync)
					.pipe(
						Effect.provideService(Reactivity.Reactivity, reactivity.value),
						Option.isSome(live) ? Effect.provideService(SyncDelivery, live.value.synced) : identity,
						Effect.retry({ schedule: Schedule.exponential("50 millis"), times: 2 }),
						Effect.catch(recoverPublication),
					);
			}
			return result;
		}),
	);
}
