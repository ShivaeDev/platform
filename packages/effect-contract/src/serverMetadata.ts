import { Context, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { Key } from "./keys.ts";
import { LiveHint } from "./live.ts";
import type { CommandShape } from "./operation.ts";

export class CommandInvalidation extends Context.Service<CommandInvalidation, CommandShape["invalidates"]>()(
	"@shivaedev/effect-contract/CommandInvalidation",
) {}

export function changesRpc(name: string) {
	return Rpc.make(`${name}.$changes`, { payload: { keys: Schema.Array(Key) }, stream: true, success: LiveHint });
}
