import { Context, Option } from "effect";
import { type Rpc, RpcSchema } from "effect/rpc";
import { ChangesQueries, CommandInvalidation, QueryDefinition } from "#serverMetadata.ts";

// A query, a live query's changes stream and any other stream only read; a command, or an RPC no contract marked, may write.
export function operationKind(rpc: Pick<Rpc.AnyWithProps, "annotations" | "successSchema">): "read" | "write" {
	if (Option.isSome(Context.getOption(rpc.annotations, CommandInvalidation))) {
		return "write";
	}
	const reads =
		Option.isSome(Context.getOption(rpc.annotations, QueryDefinition))
		|| Option.isSome(Context.getOption(rpc.annotations, ChangesQueries))
		|| RpcSchema.isStreamSchema(rpc.successSchema);
	return reads ? "read" : "write";
}
