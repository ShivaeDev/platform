import { Effect, type Layer, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import {
	AuthUnavailable,
	BadRequest,
	Conflict,
	Forbidden,
	NotFound,
	PreconditionFailed,
	TooManyRequests,
	Unauthorized,
} from "@shivaedev/errors/taxonomy.ts";
import { Identity, OptionalIdentity, RequestId } from "#identity.ts";
import { Authenticated, RequestTracing } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { trustedOrigins } from "#server/origin.ts";
import { authenticatedLayer } from "#server/session.ts";
import { requestTracingLayer } from "#server/tracing.ts";

const Guarded = RpcGroup.make(Rpc.make("Mine", { error: NotFound, success: Schema.String }))
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
	expectTypeOf(failure).toEqualTypeOf<NotFound | Unauthorized | AuthUnavailable | Forbidden | MissingReadPolicy | QueryReadDenied>();
}).pipe(
	Effect.provide(Handlers),
	Effect.provide(
		authenticatedLayer({
			origin: trustedOrigins({ allow: [], missing: "reject" }),
			provider: betterAuthSessions(() => Promise.resolve({ user: { id: "typed" } })),
		}),
	),
	Effect.provide(requestTracingLayer()),
	Effect.scoped,
);

type TaggedRejection = Schema.Top & (new (...args: never) => { readonly _tag: string });
const rejections: Readonly<Record<string, TaggedRejection>> = {
	AuthUnavailable,
	BadRequest,
	Conflict,
	Forbidden,
	NotFound,
	PreconditionFailed,
	TooManyRequests,
	Unauthorized,
};
void rejections;

// @ts-expect-error Sessions must carry a user id.
betterAuthSessions(() => Promise.resolve({ user: {} }));
// @ts-expect-error The missing-Origin decision has no default.
trustedOrigins({ allow: [] });
