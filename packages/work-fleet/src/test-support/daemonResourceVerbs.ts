import { NodeHttpClient } from "@effect/platform-node";
import { Cause, Effect, Exit, Layer } from "effect";
import { HttpClient } from "effect/http";
import { daemonLayer } from "#host/daemon.ts";
import { RPC_PATH } from "#host/daemonContract.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { described } from "#test/refusal.ts";

export function daemonResourceVerbs(engine: HostStoryEngine) {
	function resources() {
		if (engine.resources === undefined) {
			throw new Error("Deploy the daemon before observing its resources");
		}
		return engine.resources;
	}
	return {
		address: () => `http://127.0.0.1:${engine.running.port}`,
		connections: () => resources().connections,
		connectionsClosed: () => until(() => resources().connections.pipe(Effect.map((count) => count === 0))),
		peerReadsTogether: (peers: number) =>
			resources().peakConnections(
				Effect.forEach(
					Array.from({ length: peers }, (_, index) => index),
					(index) => peerRead(engine.running.port, index),
					{ concurrency: "unbounded" },
				),
			),
		rawRequestStatus: (headers: Readonly<Record<string, string>>) =>
			HttpClient.post(`http://127.0.0.1:${engine.running.port}${RPC_PATH}`, { headers }).pipe(
				Effect.map(({ status }) => status),
				Effect.provide(NodeHttpClient.layerNodeHttp),
			),
		startOnOccupiedPort: () =>
			Effect.scoped(Layer.build(daemonLayer(engine.fixture.host, engine.fixture.parts, engine.running.port))).pipe(
				Effect.exit,
				Effect.map((exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "started")),
			),
	};
}

function peerRead(port: number, index: number) {
	return Effect.gen(function* () {
		const client = yield* daemonClient(`http://127.0.0.1:${port}`, { "x-request-id": `peer-${index}` });
		const record = yield* client("fleet.get", { workId: "one" });
		const missing = yield* client("fleet.get", { workId: "missing" }).pipe(Effect.match({ onFailure: described, onSuccess: () => "found" }));
		return { attempts: record.attempts.length, missing };
	}).pipe(Effect.scoped);
}
