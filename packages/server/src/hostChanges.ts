import { Context, Effect, Layer, Option, Stream } from "effect";
import { Headers } from "effect/http";
import { Rpc, type RpcGroup } from "effect/rpc";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import type { QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { currentSessionContext } from "@shivaedev/identity/server/currentSessionContext.ts";
import { recheckSession } from "@shivaedev/identity/server/recheckSession.ts";
import { revalidateStream } from "@shivaedev/identity/server/revalidateStream.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { resolveChanges } from "@shivaedev/identity/server/sessionKeys.ts";
import { rerunQuery } from "#rerunQuery.ts";

export function hostChanges<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const changes = yield* Effect.serviceOption(LiveServer);
			const sessions = yield* Effect.serviceOption(SessionPolicy);
			const services = yield* Effect.context<never>();
			const handlers = new Map<string, unknown>();
			function subscribe(rpc: Rpc.AnyWithProps, queries: readonly QueryReference[], options: Parameters<Rpc.Handler<string>["handler"]>[1]) {
				return Stream.unwrap(
					Effect.gen(function* () {
						const { subscription, context } = yield* resolveChanges(rpc, queries);
						const viewer = yield* CurrentViewer;
						const refresh = refreshSession(sessions, viewer, rpc._tag);
						const stream = Option.isSome(changes)
							? Stream.unwrap(changes.value.subscribe({ ...subscription, refresh }, context, rerunQuery(group, options)))
							: Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never);
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
			for (const rpc of group.requests.values()) {
				if (!(Rpc.isRpc(rpc) && rpc._tag.endsWith(".$changes"))) {
					continue;
				}
				const provided = services.mapUnsafe.get(rpc.key);
				if (Option.isNone(changes) && provided !== undefined) {
					handlers.set(rpc.key, provided);
					continue;
				}
				handlers.set(rpc.key, {
					context: services,
					handler: ({ queries }: { readonly queries: readonly QueryReference[] }, options: Parameters<Rpc.Handler<string>["handler"]>[1]) =>
						subscribe(rpc, queries, options),
					tag: rpc._tag,
				});
			}
			return Context.makeUnsafe<Rpc.ToHandler<Extract<R, { readonly _tag: `${string}.$changes` }>>>(handlers);
		}),
	);
}

function refreshSession(sessions: Option.Option<typeof SessionPolicy.Service>, viewer: Option.Option<Viewer>, tag: string) {
	if (Option.isNone(sessions) || Option.isNone(viewer)) {
		return Effect.context<never>();
	}
	return currentSessionContext(viewer.value.id, recheckSession(Headers.empty, tag)).pipe(Effect.provideService(SessionPolicy, sessions.value));
}
