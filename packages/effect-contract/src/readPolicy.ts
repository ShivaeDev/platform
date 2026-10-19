import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { Key } from "./keys.ts";
import { QueryReads } from "./serverMetadata.ts";

export const ReadPolicy = Context.Reference<(key: Key) => Effect.Effect<boolean>>("@shivaedev/effect-contract/ReadPolicy", {
	defaultValue: () => () => Effect.succeed(true),
});

export const authorizeReads = Effect.fnUntraced(function* <A, E, R, TPolicyServices, TDenied>(
	effect: Effect.Effect<A, E, R>,
	request: { readonly rpc: Rpc.AnyWithProps; readonly payload: unknown },
	policy: (key: Key) => Effect.Effect<boolean, never, TPolicyServices>,
	denied: Effect.Effect<never, TDenied>,
) {
	const context = yield* Effect.context<TPolicyServices>();
	function canRead(key: Key) {
		return Effect.provideContext(policy(key), context);
	}
	const reads = Context.getOption(request.rpc.annotations, QueryReads);
	if (Option.isSome(reads)) {
		for (const key of reads.value(request.payload)) {
			if (!(yield* canRead(key))) {
				return yield* denied;
			}
		}
	}
	return yield* Effect.provideService(effect, ReadPolicy, canRead);
});
