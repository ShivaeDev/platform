import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { isFleetError } from "#errors.ts";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";

const { DAEMON_PORT } = diagnosticsApi;

export function daemonClient(port: number = DAEMON_PORT) {
	return RpcClient.make(DaemonContract, { flatten: true }).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}${RPC_PATH}` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			),
		),
	);
}

export function daemonRequest<A, E, R>(
	port: number,
	use: (client: Effect.Success<ReturnType<typeof daemonClient>>) => Effect.Effect<A, E, R>,
	request = "request",
	timeoutMs = 5000,
) {
	return Effect.scoped(daemonClient(port).pipe(Effect.flatMap(use))).pipe(
		Effect.timeout(timeoutMs),
		Effect.mapError((error) => daemonError(error, port, request)),
	);
}

export function daemonError(error: unknown, port: number, request = "request") {
	if (isFleetError(error) && (error._tag !== "ServiceUnavailable" || request === "request")) {
		return error;
	}
	const refused = error instanceof RpcClientError && connectionRefused(error.reason);
	const timeout = requestTimedOut(error);
	const detail = error instanceof Error ? error.message : String(error);
	const recording = request.startsWith("answer ") ? "; answer recording is unconfirmed; check status or watch before retrying" : "";
	return new ServiceUnavailable({
		message: refused
			? `No Fleet daemon is running at 127.0.0.1:${port}; start work-fleet serve <board-dir> --port ${port}`
			: `Fleet daemon ${request} ${timeout ? "timed out" : "failed"} at 127.0.0.1:${port}: ${detail}${recording}`,
	});
}

function requestTimedOut(value: unknown, depth = 0): boolean {
	if (typeof value !== "object" || value === null || depth > 8) {
		return false;
	}
	return (
		("_tag" in value && value._tag === "TimeoutError")
		|| ("name" in value && value.name === "TimeoutError")
		|| ("code" in value && ["ETIMEDOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(String(value.code)))
		|| ("cause" in value && requestTimedOut(value.cause, depth + 1))
		|| ("reason" in value && requestTimedOut(value.reason, depth + 1))
	);
}

function connectionRefused(value: unknown, depth = 0): boolean {
	if (typeof value !== "object" || value === null || depth > 8) {
		return false;
	}
	return (
		("code" in value && value.code === "ECONNREFUSED")
		|| ("cause" in value && connectionRefused(value.cause, depth + 1))
		|| ("reason" in value && connectionRefused(value.reason, depth + 1))
	);
}
