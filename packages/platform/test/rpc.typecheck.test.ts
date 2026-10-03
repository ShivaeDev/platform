import { Effect, type Layer, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { expectTypeOf } from "vitest";
import { AuthUnavailable, BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, TooManyRequests, Unauthorized } from "../src/errors.ts";
import { Authenticated, Identity, OptionalIdentity, RequestId, RequestTracing } from "../src/rpc.ts";
import { authenticatedLayer, betterAuthSessions, requestTracingLayer, trustedOrigins } from "../src/rpc-server.ts";

const Guarded = RpcGroup.make(Rpc.make("Mine", { success: Schema.String, error: NotFound }))
	.middleware(Authenticated)
	.middleware(RequestTracing);
const Open = RpcGroup.make(Rpc.make("Mine", { success: Schema.String }));

const Handlers = Guarded.toLayer({
	Mine: () => Effect.map(Effect.all([Identity, RequestId]), ([identity, requestId]) => `${identity.id}${requestId}`),
});

const handlersWithout: Layer.Layer<never> = Handlers;
// @ts-expect-error Identity is only provided to RPCs guarded by Authenticated.
const unguarded: Layer.Layer<never> = Open.toLayer({ Mine: () => Effect.map(Identity, (identity) => identity.id) });
// @ts-expect-error Authenticated provides Identity, not OptionalIdentity.
const optional: Layer.Layer<never> = Guarded.toLayer({ Mine: () => Effect.map(OptionalIdentity, () => "") });
void [handlersWithout, unguarded, optional];

Effect.gen(function* () {
	const client = yield* RpcTest.makeClient(Guarded);
	const failure = yield* Effect.flip(client.Mine());
	expectTypeOf(failure).toEqualTypeOf<NotFound | Unauthorized | AuthUnavailable | Forbidden>();
}).pipe(
	Effect.provide(Handlers),
	Effect.provide(
		authenticatedLayer({
			provider: betterAuthSessions(() => Promise.resolve({ user: { id: "typed" } })),
			origin: trustedOrigins({ allow: [], missing: "reject" }),
		}),
	),
	Effect.provide(requestTracingLayer()),
	Effect.scoped,
);

type TaggedRejection = Schema.Top & (new (...args: never) => { readonly _tag: string });
const rejections: Readonly<Record<string, TaggedRejection>> = {
	NotFound,
	Unauthorized,
	Forbidden,
	BadRequest,
	Conflict,
	PreconditionFailed,
	TooManyRequests,
	AuthUnavailable,
};
void rejections;

// @ts-expect-error Sessions must carry a user id.
betterAuthSessions(() => Promise.resolve({ user: {} }));
// @ts-expect-error The missing-Origin decision has no default.
trustedOrigins({ allow: [] });
