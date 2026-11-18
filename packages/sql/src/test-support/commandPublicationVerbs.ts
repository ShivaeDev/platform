import { Cause, Effect } from "effect";
import { CommandPublication } from "@shivaedev/changes/commandPublication.ts";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";
import { resyncPayload } from "#notifyPayload.ts";
import type { ChangeFeedEngine } from "#test/changeFeedEngine.ts";

export function commandPublicationVerbs(engine: ChangeFeedEngine, tell: (line: string) => void, delivered: () => Effect.Effect<unknown>) {
	function inFeed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return engine.binding === undefined ? effect : Effect.provideContext(effect, engine.binding);
	}
	return {
		anotherHostSends: (payload: string) =>
			Effect.suspend(() => {
				tell(`another host sends ${payload} on the channel`);
				return engine.other`select pg_notify(${engine.channel}, ${payload})`.pipe(Effect.orDie);
			}),
		publishCommand: (keys: readonly unknown[], sync?: SyncToken) =>
			inFeed(
				Effect.gen(function* () {
					tell(
						`publish command changes ${JSON.stringify(keys)} through the port${sync === undefined ? "" : ` with sync token ${sync.id} of ${sync.client}`}`,
					);
					const publication = yield* CommandPublication;
					return yield* publication.publish(keys, sync).pipe(
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
