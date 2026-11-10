import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { QueryReadPolicy } from "#readPolicy.ts";

export class ServedReadPolicy extends Context.Service<ServedReadPolicy, { readonly check: QueryReadPolicy<unknown, unknown, unknown> }>()(
	"@shivaedev/contract/ServedReadPolicy",
) {}

// Only a handler built by moduleHandlers carries the policy, so a hand-written handler keeps the guard's check. A call's
// middleware runs in its handler's context; a live rerun finds the query's handler by its RPC.
export function servedReadPolicy(rpc: Rpc.Any) {
	return Effect.map(Effect.context<never>(), (request) =>
		Option.orElse(Context.getOption(request, ServedReadPolicy), () =>
			Option.flatMap(Context.getOption(request, Context.Service<Rpc.Handler<string>>(rpc.key)), (handler) =>
				Context.getOption(handler.context, ServedReadPolicy),
			),
		).pipe(Option.map(({ check }) => check)),
	);
}
