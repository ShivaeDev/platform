import { connect } from "node:net";
import { join } from "node:path";
import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { workContract } from "#rpc/contract.ts";
import { RPC_PATH } from "#server/http/rpcPolicy.ts";

export class BoardToolError extends Schema.TaggedError<BoardToolError>()("BoardToolError", { message: Schema.String }) {}

function makeClient() {
	return RpcClient.make(workContract, { flatten: true });
}
export type BoardClient = Effect.Success<ReturnType<typeof makeClient>>;

function toolError(directory: string, error: unknown) {
	if (error instanceof RpcClientError || (error instanceof Error && "_tag" in error && error._tag === "TimeoutError")) {
		return new BoardToolError({ message: `No board answers in ${directory}. Start one with: work-board '${directory.replaceAll("'", "'\\''")}'` });
	}
	return new BoardToolError({ message: error instanceof Error ? error.message : String(error) });
}

export function readBoard<A, E>(directory: string, read: (client: BoardClient) => Effect.Effect<A, E>) {
	const agent = Layer.effect(
		NodeHttpClient.HttpAgent,
		Effect.map(NodeHttpClient.makeAgent({ keepAlive: true }), (agents) => {
			agents.http.createConnection = () => connect(join(directory, "board.sock"));
			return agents;
		}),
	);
	const http = NodeHttpClient.layerNodeHttpNoAgent.pipe(Layer.provide(agent));
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: HttpClient.mapRequest(HttpClientRequest.setUrl(`http://localhost${RPC_PATH}`)),
		url: "http://localhost",
	}).pipe(Layer.provide([http, RpcSerialization.layerNdjson]));
	return Effect.scoped(Effect.flatMap(makeClient(), read)).pipe(
		Effect.provide(protocol),
		Effect.timeout("10 seconds"),
		Effect.mapError((error) => toolError(directory, error)),
	);
}
