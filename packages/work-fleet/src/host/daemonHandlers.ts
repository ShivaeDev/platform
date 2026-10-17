import { Effect, Layer } from "effect";
import { exposeFailure } from "#exposeFailure.ts";
import { dispatchApproved } from "#host/admission.ts";
import { answerWork } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { nameStoredThreads } from "#host/nameThreads.ts";
import { releaseItems } from "#host/releaseWork.ts";
import { fleetStatus } from "#host/status.ts";

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const follow = yield* daemonSnapshots(host);
	const diagnostics = yield* daemonDiagnostics;
	const scope = yield* Effect.scope;
	function background<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.catchCause(Effect.logError), Effect.forkIn(scope));
	}
	function dispatch(workId: string) {
		return exposeFailure(
			dispatchApproved(host, workId, true).pipe(
				Effect.tap(() => background(dispatchApproved(host, workId))),
				Effect.map(({ value }) => value),
			),
		);
	}
	return Layer.merge(
		diagnostics,
		ClientContract.toLayer(
			Effect.succeed(
				ClientContract.of({
					"daemon.answer": ({ workId, text, release }) =>
						exposeFailure(answerWork(host, workId, text, release, true).pipe(Effect.map(({ value }) => value))),
					"daemon.dispatch": ({ workId }) => dispatch(workId),
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
