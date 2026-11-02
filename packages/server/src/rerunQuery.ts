import { Effect } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { authorizeReads, CurrentViewer, type PolicyChannels } from "@shivaedev/contract/readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { QueryRequest } from "@shivaedev/contract/serverMetadata.ts";

type Handlers<R extends Rpc.Any> = string extends R["_tag"] ? Rpc.Handler<string> : Rpc.ToHandler<R>;

export function rerunQuery<R extends Rpc.Any>(
	group: { readonly requests: ReadonlyMap<string, R> },
	options: Parameters<Rpc.Handler<string>["handler"]>[1],
): (
	request: QueryRequest,
) => Effect.Effect<
	unknown,
	Rpc.ErrorExit<R> | PolicyChannels<R>["error"] | MissingReadPolicy | QueryReadDenied,
	Handlers<R> | PolicyChannels<R>["services"]
>;
export function rerunQuery(group: { readonly requests: ReadonlyMap<string, Rpc.Any> }, options: Parameters<Rpc.Handler<string>["handler"]>[1]) {
	const prefix = options.rpc._tag.slice(0, -"$changes".length);
	return Effect.fnUntraced(function* ({ payload, query }: QueryRequest) {
		const tag = `${prefix}${query.name}`;
		const rpc = group.requests.get(tag);
		if (!Rpc.isRpc(rpc)) {
			return yield* Effect.die(new Error(`Unknown query: ${tag}`));
		}
		const handler = yield* RpcGroup.make(rpc).accessHandler(tag);
		const viewer = yield* CurrentViewer;
		const result = handler(payload, { ...options });
		if (!Effect.isEffect(result)) {
			return yield* Effect.die(new Error(`Query ${tag} must return an Effect`));
		}
		return yield* authorizeReads(result, { payload, rpc }, viewer);
	});
}
