import { Clock, Effect, Layer, Predicate, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { DAEMON_PORT, DAEMON_RPC_PATH, DaemonReadContract, DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";

function makeDaemonClient() {
	return RpcClient.make(DaemonReadContract, { flatten: true });
}
type DaemonClient = Effect.Success<ReturnType<typeof makeDaemonClient>>;

const FLEET_STOPPED = "Fleet isn't running, so agent work and its health are unknown.";

// npx runs the project's own @shivaedev/work-fleet, because the bare work-fleet command is rarely on PATH.
export function daemonUnavailable(error: unknown, port: number, folder: string): { readonly reason: string; readonly startCommand?: string } {
	const stopped = error instanceof RpcClientError && error.reason._tag === "HttpError" && error.reason.kind === "TransportError";
	return stopped
		? { reason: FLEET_STOPPED, startCommand: `npx @shivaedev/work-fleet serve ${shellWord(folder)} --port ${port}` }
		: { reason: `Fleet on port ${port} didn't answer as expected, so agent work and its health are unknown.` };
}

function shellWord(value: string) {
	return /^[\w./@%+=:,-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
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

export function daemonDiagnostics(folder: string, port: number | null = DAEMON_PORT) {
	if (port === null) {
		return Effect.gen(function* () {
			const observation = {
				cause: "Fleet isn't set up for this Board.",
				observedAt: yield* Clock.currentTimeMillis,
				state: "not-configured" as const,
			};
			return { codex: observation, fleet: observation, github: observation } satisfies DiagnosticsSnapshot;
		});
	}
	return readDaemon(port, (client) => client("daemon.diagnostics", {})).pipe(
		Effect.flatMap(decodeSnapshot),
		Effect.catch((error) =>
			Effect.gen(function* () {
				const { reason, ...start } = daemonUnavailable(error, port, folder);
				const observation = { cause: reason, observedAt: yield* Clock.currentTimeMillis, state: "error" as const, ...start };
				return { codex: observation, fleet: observation, github: observation } satisfies DiagnosticsSnapshot;
			}),
		),
	);
}

function decodeSource<A>(name: string, schema: Schema.ConstraintDecoder<A, never>, value: unknown) {
	return Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.catch((error) =>
			Effect.gen(function* () {
				return {
					cause: `${name} diagnostics decode failed: ${error.message}`,
					observedAt: yield* Clock.currentTimeMillis,
					state: "error" as const,
				};
			}),
		),
	);
}

function decodeSnapshot(value: unknown) {
	const fields = DiagnosticsSnapshot.fields;
	const sources = Predicate.isObject(value) ? value : {};
	return Effect.all({
		codex: decodeSource("Codex", fields.codex, sources.codex),
		fleet: decodeSource("Fleet", fields.fleet, sources.fleet),
		github: decodeSource("GitHub", fields.github, sources.github),
	});
}
