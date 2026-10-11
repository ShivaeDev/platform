import { Effect } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import { dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { fleetStatus } from "#host/status.ts";
import { FleetFailure } from "#policy.ts";

function expose<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.mapError((error) => (error instanceof FleetFailure ? error : new FleetFailure({ message: failureMessage(error), reason: "integration" }))),
	);
}

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const follow = yield* daemonSnapshots(host);
	return ClientContract.toLayer(
		Effect.succeed(
			ClientContract.of({
				"daemon.dispatch": ({ workId }) => expose(dispatchApproved(host, workId).pipe(Effect.map(({ value }) => value))),
				"daemon.follow": ({ workIds }) => follow(workIds),
				"daemon.status": ({ workId }) => expose(fleetStatus(host, workId)),
			}),
		),
	);
});
