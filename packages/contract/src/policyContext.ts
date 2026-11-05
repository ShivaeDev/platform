import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";

export const policyContext = Effect.fnUntraced(function* (rpc: Rpc.Any) {
	const request = yield* Effect.context<unknown>();
	const handler = Context.getOption(request, Context.Service<Rpc.Handler<string>>(rpc.key));
	return Option.isSome(handler) ? Context.merge(handler.value.context, request) : request;
});
