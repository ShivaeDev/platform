import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { ReadRecorder, type RecordReadOptions } from "@shivaedev/changes/readRecorder.ts";
import { refreshSubscription } from "#adapters/refreshSubscription.ts";
import { compareQueries } from "#compareQueries.ts";
import type { LiveHint } from "#live.ts";
import { LiveServer } from "#live-server/service.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import type { QueryRequest } from "#serverMetadata.ts";

// Matching compares serialized keys, so the same serialization identifies a registered key.
function identity(key: Key) {
	return JSON.stringify(key);
}

function subscriptionKeys<E, R>(subscription: QuerySubscription<E, R>, read: QueryRerun<E, R>, replaceKeys: (keys: readonly Key[]) => void) {
	let scopes = subscription.scopes;
	const recorded = subscription.queries.map((): readonly Key[] => []);
	const recording = subscription.queries.map(() => new Map<string, Key>());
	function merged() {
		return scopes.map((declared, index) => [...declared, ...(recorded[index] ?? [])]);
	}
	let registered = new Set(merged().flat().map(identity));
	function register() {
		const current = new Map([...merged().flat(), ...recording.flatMap((run) => [...run.values()])].map((key) => [identity(key), key]));
		if (current.size === registered.size && [...current.keys()].every((key) => registered.has(key))) {
			return;
		}
		registered = new Set(current.keys());
		replaceKeys([...current.values()]);
	}
	function recordInto(run: Map<string, Key>, declared: boolean) {
		return (keys: readonly Key[], { inferred = false }: RecordReadOptions) =>
			Effect.sync(() => {
				if (inferred && declared) {
					return;
				}
				let unregistered = false;
				for (const key of keys) {
					const id = identity(key);
					run.set(id, key);
					unregistered ||= !registered.has(id);
				}
				if (unregistered) {
					register();
				}
			});
	}
	function keep(request: QueryRequest, index: number, run: ReadonlyMap<string, Key>) {
		return Effect.suspend(() => {
			recorded[index] = [...run.values()];
			recording[index] = new Map();
			// A handler may read nothing for some payloads, so an unheard query is reported, never failed.
			return request.query.undeclaredReads === true && run.size === 0
				? Effect.logWarning(
						`Live query ${request.query.name} declares no reads and recorded no key, so no write reruns it. Mark its raw SQL reads with their keys or declare reads; reads: () => [] states that it reads nothing.`,
					)
				: Effect.void;
		});
	}
	function recordingRead(request: QueryRequest) {
		const index = subscription.queries.indexOf(request);
		const run = new Map<string, Key>();
		recording[index] = run;
		return read(request).pipe(
			Effect.provideService(ReadRecorder, recordInto(run, request.query.undeclaredReads !== true)),
			Effect.tap(() => keep(request, index, run)),
		);
	}
	function replaceScopes(next: readonly (readonly Key[])[]) {
		scopes = next;
	}
	return { merged, recordingRead, register, replaceScopes };
}

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
				const keys = subscriptionKeys(subscription, read, registration.replaceKeys);
				let compare = compareQueries(subscription, keys.recordingRead);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						compare = compareQueries(subscription, keys.recordingRead, false);
						return [new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })];
					}
					const updates = yield* compare(hint, keys.merged());
					if (subscription.readScopes !== undefined) {
						keys.replaceScopes(yield* subscription.readScopes);
					}
					keys.register();
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
