import { Effect, Layer } from "effect";
import { exposeFailure } from "#exposeFailure.ts";
import { answerWork } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { dispatchRequests } from "#host/dispatchRequests.ts";
import { nameStoredThreads } from "#host/nameThreads.ts";
import { releaseItems } from "#host/releaseWork.ts";
import { fleetStatus } from "#host/status.ts";

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const follow = yield* daemonSnapshots(host);
	const diagnostics = yield* daemonDiagnostics;
	const dispatch = yield* dispatchRequests(host);
	return Layer.merge(
		diagnostics,
		ClientContract.toLayer(
			Effect.succeed(
				ClientContract.of({
					"daemon.answer": ({ workId, text, release }) =>
						exposeFailure(answerWork(host, workId, text, release, true).pipe(Effect.map(({ value }) => value))),
					"daemon.dispatch": ({ workId }) => exposeFailure(dispatch.accept(workId)),
					"daemon.dispatch-status": ({ workId }) => exposeFailure(dispatch.get(workId)),
					"daemon.follow": ({ workIds, follow: continuous }) => follow(workIds, continuous),
					"daemon.name-threads": () => exposeFailure(nameStoredThreads(host)),
					"daemon.release": ({ workIds }) =>
						exposeFailure(releaseItems(host, workIds).pipe(Effect.map((records) => records.map(({ value }) => value)))),
					"daemon.status": ({ workId }) => exposeFailure(fleetStatus(host, workId)),
				}),
			),
		),
	);
});
