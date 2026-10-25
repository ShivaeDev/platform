import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { ConnectionError, SqlError } from "effect/sql/SqlError";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { diagnostics } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { HealthSnapshot } from "#engine/health.ts";
import { FleetRepository } from "#engine/repository.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { fleetItemStore } from "#test/fleetItemStore.ts";
import { healthSnapshot } from "#test/health.ts";

export const unavailableFleetItems = Effect.fn("HostStory.unavailableFleetItems")(function* () {
	const unavailable = Effect.fail(new diagnostics.SourceFailure({ kind: "not-configured", message: "Synthetic" }));
	const services = Layer.mergeAll(
		Layer.succeed(FleetRepository, {
			...fleetItemStore([]),
			list: () => Effect.fail(new SqlError({ reason: new ConnectionError({ cause: new Error("Repository unavailable") }) })),
		}),
		Layer.succeed(HealthSnapshot, Effect.succeed(healthSnapshot)),
		Layer.succeed(diagnostics.DiagnosticsSources, { codex: unavailable, fleet: Effect.succeed(healthSnapshot), github: unavailable }),
	);
	const context = yield* Layer.build(
		appHost({
			config: { disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 },
			group: diagnostics.DiagnosticsContract,
			handlers: Layer.unwrap(daemonDiagnostics),
			policy: "loopback",
			rpcPath: diagnostics.DAEMON_RPC_PATH,
			services,
		}),
	);
	const client = yield* daemonClient(HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address));
	return yield* client("daemon.fleetItems", {}).pipe(Effect.flip);
});
