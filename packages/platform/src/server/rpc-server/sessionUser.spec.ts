import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { expect, it } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";
import { authenticatedUserLayer, type SessionPolicy, type UserSessionShape } from "./session.ts";

const Api = RpcGroup.make(
	Rpc.make("Whoami", { success: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String }) }),
).middleware(AuthenticatedUser);
const handlers = Api.toLayer({
	Whoami: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			const user = yield* SessionUser;
			expect(identity).toEqual({ id: user.id });
			expect(user).toEqual({ email: user.email, id: user.id, name: user.name });
			return user;
		}),
});
function call(policy: SessionPolicy<UserSessionShape>) {
	return Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Api);
			return yield* client.Whoami().pipe(Effect.result);
		}).pipe(Effect.provide(handlers.pipe(Layer.provideMerge(authenticatedUserLayer(policy)))), Effect.scoped),
	);
}
it("provides only the profile fields and keeps Identity limited to id", async () => {
	const user = { email: "alice@example.test", id: "alice", name: "Alice", privateField: "provider-only" };
	const result = await call({ origin: () => true, provider: { get: () => Effect.succeed(Option.some({ user })) } });
	expect(result._tag === "Success" && result.success).toEqual({ email: user.email, id: user.id, name: user.name });
});
it("keeps missing sessions, forbidden origins and provider failures distinct", async () => {
	let lookups = 0;
	const provider = {
		get: () =>
			Effect.sync(() => {
				lookups += 1;
				return Option.none<UserSessionShape>();
			}),
	};
	const forbidden = await call({ origin: () => false, provider });
	expect(forbidden._tag === "Failure" && forbidden.failure).toBeInstanceOf(Forbidden);
	expect(lookups).toBe(0);
	const anonymous = await call({ origin: () => true, provider });
	expect(anonymous._tag === "Failure" && anonymous.failure).toBeInstanceOf(Unauthorized);
	const unavailable = await call({ origin: () => true, provider: { get: () => Effect.fail(new AuthUnavailable({ message: "Unavailable" })) } });
	expect(unavailable._tag === "Failure" && unavailable.failure).toBeInstanceOf(AuthUnavailable);
});
