import { Context, Effect, Layer, Option, Stream } from "effect";
import { Headers } from "effect/http";
import type { Rpc, RpcGroup } from "effect/rpc";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import type { QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { resolveSession, type SessionPolicy, type SessionShape } from "@shivaedev/identity/server/session.ts";
import { resolveChanges } from "@shivaedev/identity/server/sessionKeys.ts";
import type { AppChanges } from "#appHost.ts";

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
			function subscribe(rpc: Rpc.Any, queries: readonly QueryReference[]) {
				return Stream.unwrap(
					Effect.gen(function* () {
						const { subscription, context } = yield* resolveChanges(rpc, queries);
						const viewer = yield* CurrentViewer;
						const authorized = authorizeSession(sessions, rpc._tag, viewer, subscription.authorized);
						const stream = Option.isSome(changes)
							? changes.value.subscribe({ ...subscription, authorized }, context)
							: Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never);
						if (sessions === undefined || Option.isNone(viewer)) {
							return stream;
						}
						return Stream.interruptWhen(stream, sessionRevoked(sessions, rpc._tag, viewer.value.id));
					}),
				);
			}
			for (const rpc of group.requests.values()) {
				if (!rpc._tag.endsWith(".$changes")) {
					continue;
				}
				const provided = services.mapUnsafe.get(rpc.key);
				if (Option.isNone(changes) && provided !== undefined) {
					handlers.set(rpc.key, provided);
					continue;
				}
				handlers.set(rpc.key, {
					context: services,
					handler: ({ queries }: { readonly queries: readonly QueryReference[] }) => subscribe(rpc, queries),
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
	return resolveSession(sessions, Headers.empty, tag).pipe(
		Effect.map((current) => Option.isNone(viewer) || (Option.isSome(current) && current.value.user.id === viewer.value.id)),
		Effect.catch(() => Effect.succeed(false)),
		Effect.flatMap((allowed) => (allowed ? policy : Effect.succeed(false))),
	);
}

function sessionRevoked<TSession extends SessionShape>(sessions: SessionPolicy<TSession>, tag: string, id: string) {
	return Effect.gen(function* () {
		yield* Effect.sleep(sessions.streamRevalidationInterval ?? "30 seconds");
		const current = yield* resolveSession(sessions, Headers.empty, tag).pipe(Effect.catchTag("AuthUnavailable", () => Effect.succeed(undefined)));
		if (current !== undefined && (Option.isNone(current) || current.value.user.id !== id)) {
			return yield* new Unauthorized({ message: "Authentication required" });
		}
	}).pipe(Effect.forever);
}
