import { Effect, Fiber, Layer } from "effect";
import { exposeFailure } from "#exposeFailure.ts";
import { answerRequests } from "#host/answerRequests.ts";
import { answerWork } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import { configStatus } from "#host/configSettings.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { dispatchRequests } from "#host/dispatchRequests.ts";
import { LiveConfig } from "#host/liveConfig.ts";
import { nameStoredThreads } from "#host/nameThreads.ts";
import { decisionResponses, releaseItems } from "#host/releaseWork.ts";
import { fleetStatus } from "#host/status.ts";

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const scope = yield* Effect.scope;
	const follow = yield* daemonSnapshots(host);
	const diagnostics = yield* daemonDiagnostics;
	const dispatch = yield* dispatchRequests(host);
	const live = yield* LiveConfig;
	const status = Effect.zipWith(fleetStatus(host), live.current, (views, applied) => ({ ...views, config: configStatus(applied) }));
	// The server already accepts connections while handlers build, so the Board watcher starts beside them instead of delaying them.
	const responses = yield* Layer.buildWithScope(decisionResponses(host), scope).pipe(Effect.forkIn(scope));
	function withResponses<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Fiber.join(responses).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))));
	}
	const answers = yield* answerRequests(host, (workId, text, release, original) =>
		withResponses(answerWork(host, workId, text, release, true, original)),
	);
	// A client that stops waiting closes its request; the answer it asked for must still be recorded and applied.
	function settle<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.forkIn(scope), Effect.flatMap(Fiber.join));
	}
	return Layer.merge(
		diagnostics,
		ClientContract.toLayer(
			Effect.succeed(
				ClientContract.of({
					"daemon.answer": ({ workId, text, release }) => exposeFailure(settle(answers(workId, text, release))),
					"daemon.dispatch": ({ workId, now, ignoreAreas }) => exposeFailure(dispatch.accept(workId, { ignoreAreas, now })),
					"daemon.dispatch-status": ({ workId }) => exposeFailure(dispatch.get(workId)),
					"daemon.follow": ({ workIds, follow: continuous }) => follow(workIds, continuous),
					"daemon.name-threads": () => exposeFailure(nameStoredThreads(host)),
					"daemon.release": ({ workIds }) =>
						exposeFailure(settle(withResponses(releaseItems(host, workIds))).pipe(Effect.map((records) => records.map(({ value }) => value)))),
					"daemon.status": ({ workId }) => exposeFailure(workId === undefined ? status : fleetStatus(host, workId)),
				}),
			),
		),
	);
});
