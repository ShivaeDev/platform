import { Effect, Option } from "effect";
import { type Rpc, RpcSchema } from "effect/rpc";
import { type AuthUnavailable, type Forbidden, Unauthorized } from "@shivaedev/contract/errors/taxonomy.ts";
import type { SessionPolicy, SessionShape } from "./session.ts";

export function revalidateStream<TSession extends SessionShape>(
	policy: SessionPolicy<TSession>,
	rpc: Rpc.AnyWithProps,
	id: string,
	lookup: Effect.Effect<Option.Option<TSession>, AuthUnavailable | Forbidden>,
) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		if (!RpcSchema.isStreamSchema(rpc.successSchema)) {
			return effect;
		}
		const check = Effect.gen(function* () {
			yield* Effect.sleep(policy.streamRevalidationInterval ?? "30 seconds");
			const session = yield* lookup.pipe(Effect.catchTag("AuthUnavailable", () => Effect.succeed(undefined)));
			if (session !== undefined && (Option.isNone(session) || session.value.user.id !== id)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
		});
		return Effect.raceFirst(effect, Effect.forever(check));
	};
}
