import { Context, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { Key } from "./keys.ts";
import { LiveHint } from "./live.ts";
import type { CommandShape, QueryShape } from "./operation.ts";

export class QueryReads extends Context.Service<QueryReads, QueryShape["reads"]>()("@shivaedev/effect-contract/QueryReads") {}

export class CommandInvalidation extends Context.Service<CommandInvalidation, CommandShape["invalidates"]>()(
	"@shivaedev/effect-contract/CommandInvalidation",
) {}

export function changesRpc<const TName extends string>(name: TName) {
	return Rpc.make(`${name}.$changes`, { payload: { keys: Schema.Array(Key) }, stream: true, success: LiveHint });
}
