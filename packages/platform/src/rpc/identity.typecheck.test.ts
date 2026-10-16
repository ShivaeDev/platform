import { Effect, type Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { authenticatedUserLayer } from "#rpc-server/session.ts";
import { Identity, SessionUser } from "./identity.ts";
import { Authenticated, AuthenticatedUser } from "./middleware.ts";

const Profile = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(AuthenticatedUser);
const handlers: Layer.Layer<never> = Profile.toLayer({
	Whoami: () => Effect.map(Effect.all([Identity, SessionUser]), ([identity, user]) => `${identity.id} ${user.name} ${user.email}`),
});
const IdOnly = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(Authenticated);
// @ts-expect-error The id-only middleware does not provide a profile.
const missing: Layer.Layer<never> = IdOnly.toLayer({ Whoami: () => Effect.map(SessionUser, (user) => user.email) });
void missing;

authenticatedUserLayer({
	origin: () => true,
	// @ts-expect-error Profile providers must supply name and email as well as id.
	provider: { get: () => Effect.succeed(Option.some({ user: { id: "alice" } })) },
});
Effect.gen(function* () {
	const client = yield* RpcTest.makeClient(Profile);
	const failure = yield* Effect.flip(client.Whoami());
	expectTypeOf(failure).toEqualTypeOf<Unauthorized | AuthUnavailable | Forbidden>();
}).pipe(Effect.provide(handlers), Effect.scoped);
