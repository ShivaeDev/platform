import { Context, Effect, Option, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import { CommandPublication, type CommandPublicationError } from "@shivaedev/changes/commandPublication.ts";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { CommandInvalidation } from "@shivaedev/contract/serverMetadata.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";

const recoverPublication = Effect.fnUntraced(function* (cause: CommandPublicationError) {
	yield* Effect.logError("Committed command invalidation failed; resynchronizing live streams", cause);
	const publication = yield* CommandPublication;
	yield* publication.recover.pipe(
		Effect.catch((error) => Effect.logError("Committed command Resync broadcast failed; other hosts may remain stale", error)),
	);
});

export function commandChanges<A, E, R>(effect: Effect.Effect<A, E, R>, rpc: Rpc.AnyWithProps, payload: unknown) {
	const invalidates = Context.getOption(rpc.annotations, CommandInvalidation);
	if (Option.isNone(invalidates)) {
		return effect;
	}
	const declared = invalidates.value.invalidates;
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
			const viewer = yield* CurrentViewer;
			const keys = invalidationKeys(declared(payload, result, viewer)).filter((key) => !published.has(key));
			if (keys.length > 0) {
				const publication = yield* CommandPublication;
				yield* publication
					.publish(keys)
					.pipe(
						Effect.provideService(Reactivity.Reactivity, reactivity.value),
						Effect.retry({ schedule: Schedule.exponential("50 millis"), times: 2 }),
						Effect.catch(recoverPublication),
					);
			}
			return result;
		}),
	);
}
