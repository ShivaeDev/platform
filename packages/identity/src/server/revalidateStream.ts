import { Effect, type Option } from "effect";
import { type Rpc, RpcSchema } from "effect/rpc";
import type { AuthUnavailable, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { currentSessionContext } from "#server/adapters/currentSessionContext.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import type { SessionShape } from "#server/session.ts";
import { revalidateSession } from "#server/socketSession.ts";

export function revalidateStream<TSession extends SessionShape, TLookupRequirements, TLookupError = AuthUnavailable | Forbidden>(
	rpc: Rpc.AnyWithProps,
	id: string,
	lookup: Effect.Effect<Option.Option<TSession>, TLookupError, TLookupRequirements>,
) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		if (!RpcSchema.isStreamSchema(rpc.successSchema)) {
			return effect;
		}
		const check = Effect.asVoid(currentSessionContext(id, lookup));
		return Effect.flatMap(SessionPolicy, (policy) =>
			Effect.raceFirst(effect, revalidateSession(check, policy.streamRevalidationInterval ?? "30 seconds")),
		);
	};
}
