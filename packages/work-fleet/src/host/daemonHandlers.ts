import { Effect, Layer } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import { dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { decideWork } from "#host/decideWork.ts";
import { nameStoredThreads } from "#host/nameThreads.ts";
import { releaseItems } from "#host/releaseWork.ts";
import { fleetStatus } from "#host/status.ts";
import { FleetFailure } from "#policy.ts";

function expose<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.mapError((error) => (error instanceof FleetFailure ? error : new FleetFailure({ message: failureMessage(error), reason: "integration" }))),
	);
}

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const follow = yield* daemonSnapshots(host);
	const diagnostics = yield* daemonDiagnostics;
	return Layer.merge(
		diagnostics,
		ClientContract.toLayer(
			Effect.succeed(
				ClientContract.of({
					"daemon.decide": ({ workId, action }) => expose(decideWork(host, workId, action).pipe(Effect.map(({ value }) => value))),
					"daemon.dispatch": ({ workId }) => expose(dispatchApproved(host, workId).pipe(Effect.map(({ value }) => value))),
					"daemon.follow": ({ workIds }) => follow(workIds),
					"daemon.name-threads": () => expose(nameStoredThreads(host)),
					"daemon.release": ({ workIds }) => expose(releaseItems(host, workIds).pipe(Effect.map((records) => records.map(({ value }) => value)))),
					"daemon.status": ({ workId }) => expose(fleetStatus(host, workId)),
				}),
			),
		),
	);
});
