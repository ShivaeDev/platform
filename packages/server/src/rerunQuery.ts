import { Context, Effect } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { authorizeReads, CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import type { QueryRequest } from "@shivaedev/contract/serverMetadata.ts";

export function rerunQuery(group: { readonly requests: ReadonlyMap<string, Rpc.Any> }, options: Parameters<Rpc.Handler<string>["handler"]>[1]) {
	const prefix = options.rpc._tag.slice(0, -"$changes".length);
	return Effect.fnUntraced(function* ({ payload, query }: QueryRequest): Effect.fn.Return<unknown, unknown> {
		const tag = `${prefix}${query.name}`;
		const rpc = group.requests.get(tag);
		if (!Rpc.isRpc(rpc)) {
			return yield* Effect.die(new Error(`Unknown query: ${tag}`));
		}
		const services = Context.makeUnsafe<Rpc.Handler<string>>((yield* Effect.context<never>()).mapUnsafe);
		const handler = yield* RpcGroup.make(rpc).accessHandler(tag).pipe(Effect.provideContext(services));
		const viewer = yield* CurrentViewer;
		const result = handler(payload, { ...options });
		if (!Effect.isEffect(result)) {
			return yield* Effect.die(new Error(`Query ${tag} must return an Effect`));
		}
		return yield* authorizeReads(result, { payload, rpc }, viewer).pipe(Effect.provideContext(Context.makeUnsafe<unknown>(services.mapUnsafe)));
	});
}
