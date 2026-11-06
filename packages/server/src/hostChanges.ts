import { Context, Effect, Layer, Option, Stream } from "effect";
import { Headers } from "effect/http";
import type { Rpc, RpcGroup } from "effect/rpc";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { compareQueries } from "@shivaedev/contract/compareQueries.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { subscribe as subscribeQueries } from "@shivaedev/contract/live-server/subscribe.ts";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import type { QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { currentSessionContext } from "@shivaedev/identity/server/adapters/currentSessionContext.ts";
import { recheckSession } from "@shivaedev/identity/server/recheckSession.ts";
import { resolveChanges } from "@shivaedev/identity/server/resolveChanges.ts";
import { revalidateStream } from "@shivaedev/identity/server/revalidateStream.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { rerunQuery } from "#rerunQuery.ts";

export function hostChanges<R extends Rpc.Any>(
	group: RpcGroup.RpcGroup<R>,
): Layer.Layer<
	Rpc.ToHandler<Extract<R, { readonly _tag: `${string}.$changes` }>>,
	never,
	| Rpc.ExtractRequires<Extract<R, { readonly _tag: `${string}.$changes` }>, `${string}.$changes`>
	| Rpc.ToHandler<Exclude<R, { readonly _tag: `${string}.$changes` }>>
>;
export function hostChanges(group: RpcGroup.RpcGroup<Rpc.Any>) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const changes = yield* Effect.serviceOption(LiveServer);
			const sessions = yield* Effect.serviceOption(SessionPolicy);
			const retained: Layer.Layer<Rpc.Handler<string>>[] = [];
			if (Option.isNone(changes)) {
				for (const rpc of group.requests.values()) {
					if (!rpc._tag.endsWith(".$changes")) {
						continue;
					}
					const key = Context.Service<Rpc.Handler<string>>(rpc.key);
					const provided = yield* Effect.serviceOption(key);
					if (Option.isSome(provided)) {
						retained.push(Layer.succeed(key, provided.value));
					}
				}
			}
			const hosted = changesHandlerLayer(
				group,
				(rpc) =>
					({ queries }: { readonly queries: readonly QueryReference[] }, options: Parameters<Rpc.Handler<string>["handler"]>[1]) =>
						subscribe(group, changes, sessions, rpc, queries, options),
			);
			return Layer.mergeAll(hosted, ...retained);
		}),
	);
}

function subscribe(
	group: RpcGroup.RpcGroup<Rpc.Any>,
	changes: Option.Option<Context.Service.Shape<typeof LiveServer>>,
	sessions: Option.Option<typeof SessionPolicy.Service>,
	rpc: Rpc.AnyWithProps,
	queries: readonly QueryReference[],
	options: Parameters<Rpc.Handler<string>["handler"]>[1],
) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const subscription = yield* resolveChanges(rpc, queries);
			const viewer = yield* CurrentViewer;
			const refresh = refreshSession(sessions, viewer, rpc._tag);
			const read = rerunQuery(group, options);
			type Failure = Effect.Error<typeof subscription.authorized | typeof refresh | ReturnType<typeof read>>;
			const stream = Option.isSome(changes)
				? Stream.unwrap(
						subscribeQueries<Failure, Effect.Services<ReturnType<typeof read>>, typeof read>({ ...subscription, refresh }, read).pipe(
							Effect.provideService(LiveServer, changes.value),
						),
					)
				: Stream.concat(
						Stream.fromEffect(compareQueries(subscription, read)({ _tag: "Resync" })).pipe(Stream.flatMap(Stream.fromIterable)),
						Stream.never,
					);
			if (Option.isNone(sessions) || Option.isNone(viewer)) {
				return stream;
			}
			const revalidation = Effect.never.pipe(
				revalidateStream(rpc, viewer.value.id, recheckSession(Headers.empty, rpc._tag)),
				Effect.provideService(SessionPolicy, sessions.value),
			);
			return Stream.interruptWhen(stream, revalidation);
		}),
	);
}

function refreshSession(sessions: Option.Option<typeof SessionPolicy.Service>, viewer: Option.Option<Viewer>, tag: string) {
	if (Option.isNone(sessions) || Option.isNone(viewer)) {
		return Effect.context<never>();
	}
	return currentSessionContext(viewer.value.id, recheckSession(Headers.empty, tag)).pipe(Effect.provideService(SessionPolicy, sessions.value));
}
