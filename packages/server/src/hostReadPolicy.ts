import { Effect, Layer, Option, Schema } from "effect";
import { type Rpc, type RpcGroup, RpcMiddleware } from "effect/rpc";
import { authorizeReads, type ReadKeyPolicy } from "@shivaedev/contract/readPolicy.ts";
import { AuthUnavailable, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { Identity, type IdentityValue, OptionalIdentity } from "@shivaedev/identity/identity.ts";

class HostReadPolicy extends RpcMiddleware.Service<HostReadPolicy>()("@shivaedev/server/ReadPolicy", {
	error: Schema.Union([Forbidden, AuthUnavailable]),
}) {}

export function readPolicyGroup<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	const guarded = group.middleware(HostReadPolicy);
	for (const rpc of guarded.requests.values()) {
		const middlewares = new Set(rpc.middlewares);
		middlewares.delete(HostReadPolicy);
		Object.assign(rpc, { middlewares: new Set([HostReadPolicy, ...middlewares]) });
	}
	return guarded;
}

export function hostReadPolicy<R>(policy: ReadKeyPolicy<IdentityValue, AuthUnavailable | Forbidden, R>) {
	return Layer.effect(
		HostReadPolicy,
		Effect.map(
			Effect.context<R>(),
			(context) => (effect, request) =>
				Effect.gen(function* () {
					const identity = yield* Effect.serviceOption(Identity);
					const optional = yield* Effect.serviceOption(OptionalIdentity);
					const viewer = Option.orElse(identity, () => Option.flatten(optional));
					return yield* authorizeReads(
						effect,
						request,
						(key, current) => Effect.provideContext(policy(key, current), context),
						viewer,
						Effect.fail(new Forbidden({ message: "Read not allowed" })),
					);
				}),
		),
	);
}
