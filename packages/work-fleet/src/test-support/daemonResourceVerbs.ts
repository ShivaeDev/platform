import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { daemonLayer } from "#host/daemon.ts";
import { RPC_PATH } from "#host/daemonContract.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

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
		peakConnections: <A, E, R>(action: Effect.Effect<A, E, R>) => resources().peakConnections(action),
		peerReads: (index: number) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(`http://127.0.0.1:${engine.running.port}`, { "x-request-id": `peer-${index}` });
				const record = yield* client("fleet.get", { workId: "one" });
				const missing = yield* client("fleet.get", { workId: "missing" }).pipe(Effect.flip);
				return { missing, record };
			}).pipe(Effect.scoped),
		rawRequest: (headers: Readonly<Record<string, string>>) =>
			HttpClient.post(`http://127.0.0.1:${engine.running.port}${RPC_PATH}`, { headers }).pipe(Effect.provide(NodeHttpClient.layerNodeHttp)),
		startOnOccupiedPort: () =>
			Effect.scoped(Layer.build(daemonLayer(engine.fixture.host, engine.fixture.parts, engine.running.port))).pipe(Effect.exit),
	};
}
