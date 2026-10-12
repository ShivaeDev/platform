import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { DAEMON_PORT } from "@shivaedev/work-board/diagnostics/daemonContract.ts";
import { isFleetError } from "#errors.ts";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";

export function daemonClient(port = DAEMON_PORT) {
	return RpcClient.make(DaemonContract, { flatten: true }).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}${RPC_PATH}` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			),
		),
	);
}

export function daemonRequest<A, E, R>(port: number, use: (client: Effect.Success<ReturnType<typeof daemonClient>>) => Effect.Effect<A, E, R>) {
	return Effect.scoped(daemonClient(port).pipe(Effect.flatMap(use))).pipe(Effect.mapError((error) => daemonError(error, port)));
}

export function daemonError(error: unknown, port: number) {
	if (isFleetError(error)) {
		return error;
	}
	const transport = error instanceof RpcClientError && error.reason._tag === "HttpError" && error.reason.kind === "TransportError";
	return new ServiceUnavailable({
		message: transport
			? `No Fleet daemon is running at 127.0.0.1:${port}; start work-fleet serve <board-dir> --port ${port}`
			: `Fleet daemon communication failed at 127.0.0.1:${port}: ${error instanceof Error ? error.message : String(error)}`,
	});
}
