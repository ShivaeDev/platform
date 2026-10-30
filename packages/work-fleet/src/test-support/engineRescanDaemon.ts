import { Context, Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import type { EngineStory } from "#test/engineState.ts";
import { hostFixture } from "#test/fleetHost.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

export function engineRescanDaemon(state: EngineStory, tell: (line: string) => void) {
	function port() {
		if (state.rescanPort === undefined) {
			throw new Error("No rescan daemon is running");
		}
		return state.rescanPort;
	}
	return {
		rescanStatus: () => {
			tell("request daemon status while the Board rescan is in flight");
			return daemonRequest(port(), (client) => client("daemon.status", {}));
		},
		rescanWatch: () => {
			tell("request a watch snapshot while the Board rescan is in flight");
			return daemonRequest(port(), (client) =>
				client("daemon.watch", { workIds: ["item.0"] }).pipe(
					Stream.filter((snapshot) => snapshot.states !== undefined),
					Stream.take(1),
					Stream.runCollect,
				),
			);
		},
		startRescanDaemon: () =>
			Effect.gen(function* () {
				tell("serve the engine's durable records through the Fleet daemon");
				const fixture = yield* hostFixture();
				const source = state.sourceReads;
				if (source === undefined) {
					return yield* Effect.die("No tracked Board is configured");
				}
				const host = { ...fixture.host, boardDir: state.root };
				const parts = {
					...fixture.parts,
					board: Layer.merge(source.board, Layer.succeed(ReportInspection)({ check: () => Effect.void })),
				};
				const context = yield* Layer.build(readDaemonLayer(host, { parts }));
				const address = Context.get(context, HttpServer.HttpServer).address;
				if (!NetAddress.isInetAddress(address)) {
					return yield* Effect.die("Expected a TCP daemon");
				}
				state.rescanPort = address.port;
			}),
	};
}
