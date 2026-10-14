import { Clock, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { DAEMON_PORT, DAEMON_RPC_PATH, DiagnosticsContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";

function makeDaemonClient() {
	return RpcClient.make(DiagnosticsContract, { flatten: true });
}
type DaemonClient = Effect.Success<ReturnType<typeof makeDaemonClient>>;

export function daemonUnavailableReason(error: unknown, port: number) {
	const stopped = error instanceof RpcClientError && error.reason._tag === "HttpError" && error.reason.kind === "TransportError";
	return stopped
		? `No Fleet daemon is running at 127.0.0.1:${port}; start work-fleet serve <board-dir> --port ${port}`
		: `Fleet daemon communication failed at 127.0.0.1:${port}`;
}

export function readDaemon<A, E>(port: number, read: (client: DaemonClient) => Effect.Effect<A, E>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const client = yield* makeDaemonClient();
			return yield* read(client);
		}).pipe(
			Effect.provide(
				RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}${DAEMON_RPC_PATH}` }).pipe(
					Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				),
			),
			Effect.timeout("5 seconds"),
		),
	);
}

export function daemonDiagnostics(port: number | null = DAEMON_PORT) {
	if (port === null) {
		return Effect.gen(function* () {
			const observation = {
				cause: "Fleet daemon is not configured for this Board",
				observedAt: yield* Clock.currentTimeMillis,
				state: "not-configured" as const,
			};
			return { codex: observation, fleet: observation, github: observation } satisfies DiagnosticsSnapshot;
		});
	}
	return readDaemon(port, (client) => client("daemon.diagnostics", {})).pipe(
		Effect.catch((error) =>
			Effect.gen(function* () {
				const observation = { cause: daemonUnavailableReason(error, port), observedAt: yield* Clock.currentTimeMillis, state: "error" as const };
				return { codex: observation, fleet: observation, github: observation } satisfies DiagnosticsSnapshot;
			}),
		),
	);
}
