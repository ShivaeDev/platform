import type { Schema } from "effect";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { QueryUpdate } from "#queryUpdate.ts";

// A bound contract calls its operations by runtime tag. Effect types a client call by its literal tag and gives `Rpc.Any` no payload, and its own
// AtomRpc erases dynamic calls the same way. Each view names what the declaration guarantees for the tags used with it: queries and commands
// are unary, declared streams stream, and every contract group carries its `$changes` subscription.
type OperationsClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>;

export type UnaryClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

export type StreamingClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<string, Schema.Top, RpcSchema.Stream<Schema.Top, Schema.Top>, Schema.Never>
>;

export type ChangesClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<
		`${string}.$changes`,
		Schema.Struct<{ queries: Schema.$Array<Schema.Struct<{ query: Schema.String; payload: Schema.Unknown }>> }>,
		RpcSchema.Stream<Schema.Schema<QueryUpdate>, Schema.Unknown>,
		Schema.Never
	>
>;

export function unaryClient(client: OperationsClient): UnaryClient;
export function unaryClient(client: unknown): unknown {
	return client;
}

export function streamingClient(client: OperationsClient): StreamingClient;
export function streamingClient(client: unknown): unknown {
	return client;
}

export function changesClient(client: OperationsClient): ChangesClient;
export function changesClient(client: unknown): unknown {
	return client;
}
