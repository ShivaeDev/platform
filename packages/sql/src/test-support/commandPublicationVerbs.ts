import { Cause, Effect } from "effect";
import { CommandPublication } from "@shivaedev/changes/commandPublication.ts";
import { resyncPayload } from "#notifyPayload.ts";
import type { ChangeFeedEngine } from "#test/changeFeedEngine.ts";

export function commandPublicationVerbs(engine: ChangeFeedEngine, tell: (line: string) => void, delivered: () => Effect.Effect<unknown>) {
	function inFeed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return engine.binding === undefined ? effect : Effect.provideContext(effect, engine.binding);
	}
	return {
		publishCommand: (keys: readonly unknown[]) =>
			inFeed(
				Effect.gen(function* () {
					tell(`publish command changes ${JSON.stringify(keys)} through the port`);
					const publication = yield* CommandPublication;
					return yield* publication.publish(keys).pipe(
						Effect.as({ outcome: "published" }),
						Effect.catchTag("CommandPublicationError", (error) =>
							Effect.succeed({ cause: Cause.pretty(error.cause), outcome: "publication failed" }),
						),
					);
				}),
			),
		recoverCommand: () =>
			inFeed(
				Effect.gen(function* () {
					tell("recover the failed command publication through the port");
					const publication = yield* CommandPublication;
					yield* publication.recover;
				}),
			),
		resyncBroadcasts: () =>
			Effect.andThen(
				delivered(),
				Effect.sync(() => engine.controls.payloads.filter((payload) => payload === resyncPayload).map(() => "Resync")),
			),
	};
}
