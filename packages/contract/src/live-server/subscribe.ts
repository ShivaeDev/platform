import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { ReadRecorder } from "@shivaedev/changes/readRecorder.ts";
import { refreshSubscription } from "#adapters/refreshSubscription.ts";
import { compareQueries } from "#compareQueries.ts";
import type { LiveHint } from "#live.ts";
import { LiveServer } from "#live-server/service.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import type { QueryRequest } from "#serverMetadata.ts";

function subscribeQueries<E, R>(
	subscription: QuerySubscription<E, R>,
	read: QueryRerun<E, R>,
): Effect.Effect<Stream.Stream<QueryUpdate, E | QueryReadDenied, R>, never, typeof LiveServer.Identifier>;
function subscribeQueries<E, R>(subscription: QuerySubscription<E, R>, read: QueryRerun<E, R>) {
	return Effect.fnUntraced(function* () {
		const server = yield* LiveServer;
		const hints = yield* server.register(subscription.keys);
		return hints.pipe(
			Stream.flatMap((registration) => {
				let scopes = subscription.scopes;
				const recorded = subscription.queries.map((): readonly Key[] => []);
				const recording = subscription.queries.map((): readonly Key[] => []);
				function merged() {
					return scopes.map((declared, index) => [...declared, ...(recorded[index] ?? [])]);
				}
				function register() {
					registration.replaceKeys([...merged(), ...recording].flat());
				}
				function recordingRead(request: QueryRequest) {
					const index = subscription.queries.indexOf(request);
					const run: Key[] = [];
					recording[index] = run;
					return read(request).pipe(
						Effect.provideService(ReadRecorder, (keys) =>
							Effect.sync(() => {
								run.push(...keys);
								register();
							}),
						),
						Effect.tap(() =>
							Effect.sync(() => {
								recorded[index] = run;
								recording[index] = [];
							}),
						),
					);
				}
				let compare = compareQueries(subscription, recordingRead);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						compare = compareQueries(subscription, recordingRead, false);
						return [new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })];
					}
					const updates = yield* compare(hint, merged());
					if (subscription.readScopes !== undefined) {
						scopes = yield* subscription.readScopes;
					}
					register();
					return updates;
				});
				return registration.stream.pipe(
					Stream.mapEffect((hint) => refreshSubscription(subscription, next(hint))),
					Stream.flatMap(Stream.fromIterable),
				);
			}),
		);
	})();
}

export const subscribe = Effect.fn("LiveServer.subscribe")(subscribeQueries);
