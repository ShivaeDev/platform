import { Context, Effect, Layer, Option, Stream } from "effect";
import { Headers } from "effect/http";
import { Rpc, type RpcGroup } from "effect/rpc";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import type { QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { recheckSession } from "@shivaedev/identity/server/recheckSession.ts";
import { revalidateStream } from "@shivaedev/identity/server/revalidateStream.ts";
import type { SessionPolicy, SessionShape } from "@shivaedev/identity/server/session.ts";
import { resolveChanges } from "@shivaedev/identity/server/sessionKeys.ts";
import type { AppChanges } from "#appHost.ts";
import { rerunQuery } from "#rerunQuery.ts";

export function hostChanges<R extends Rpc.Any, TSession extends SessionShape>(
	group: RpcGroup.RpcGroup<R>,
	changesService: typeof AppChanges,
	sessions?: SessionPolicy<TSession>,
) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const changes = yield* Effect.serviceOption(changesService);
			const services = yield* Effect.context<never>();
			const handlers = new Map<string, unknown>();
			function subscribe(rpc: Rpc.AnyWithProps, queries: readonly QueryReference[], options: Parameters<Rpc.Handler<string>["handler"]>[1]) {
				return Stream.unwrap(
					Effect.gen(function* () {
						const { subscription, context } = yield* resolveChanges(rpc, queries);
						const viewer = yield* CurrentViewer;
						const authorized = authorizeSession(sessions, rpc._tag, viewer, subscription.authorized);
						const stream = Option.isSome(changes)
							? changes.value.subscribe({ ...subscription, authorized }, context, rerunQuery(group, options))
							: Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never);
						if (sessions === undefined || Option.isNone(viewer)) {
							return stream;
						}
						const revalidation = Effect.never.pipe(
							revalidateStream(sessions, rpc, viewer.value.id, recheckSession(sessions, Headers.empty, rpc._tag)),
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

function authorizeSession<TSession extends SessionShape, E, R>(
	sessions: SessionPolicy<TSession> | undefined,
	tag: string,
	viewer: Option.Option<Viewer>,
	policy: Effect.Effect<boolean, E, R>,
) {
	if (sessions === undefined) {
		return policy;
	}
	return recheckSession(sessions, Headers.empty, tag).pipe(
		Effect.map((current) => Option.isNone(viewer) || (Option.isSome(current) && current.value.user.id === viewer.value.id)),
		Effect.flatMap(
			(allowed): Effect.Effect<boolean, E | Unauthorized, R> =>
				allowed ? policy : Effect.fail(new Unauthorized({ message: "Authentication required" })),
		),
	);
}
