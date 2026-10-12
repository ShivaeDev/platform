import { Clock, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { DAEMON_PORT, DAEMON_RPC_PATH, DiagnosticsContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";

const daemonUnavailable = Effect.fn("WorkBoard.daemonUnavailable")(function* (error: unknown, port: number) {
	const stopped = error instanceof RpcClientError && error.reason._tag === "HttpError" && error.reason.kind === "TransportError";
	const observation = {
		cause: stopped
			? `No Fleet daemon is running at 127.0.0.1:${port}; start work-fleet serve <board-dir> --port ${port}`
			: `Fleet daemon communication failed at 127.0.0.1:${port}`,
		observedAt: yield* Clock.currentTimeMillis,
		state: "error" as const,
	};
	return { codex: observation, fleet: observation, github: observation } satisfies DiagnosticsSnapshot;
});

export function daemonDiagnostics(port = DAEMON_PORT) {
	return Effect.scoped(
		Effect.gen(function* () {
			const client = yield* RpcClient.make(DiagnosticsContract, { flatten: true });
			return yield* client("daemon.diagnostics", {});
		}).pipe(
			Effect.provide(
				RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}${DAEMON_RPC_PATH}` }).pipe(
					Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				),
			),
			Effect.timeout("5 seconds"),
			Effect.catch((error) => daemonUnavailable(error, port)),
		),
	);
}
