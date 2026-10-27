import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Fiber, Layer, Redacted, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { databaseAddress } from "@shivaedev/server/databaseAddress.ts";
import { exposeFailure } from "#exposeFailure.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import { answerRequests } from "#host/answerRequests.ts";
import { answerWork } from "#host/answerWork.ts";
import { checkStuck } from "#host/checkStuck.ts";
import type { FleetHost } from "#host/config.ts";
import { configStatus } from "#host/configSettings.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { daemonSnapshots } from "#host/daemonSnapshots.ts";
import { dispatchRequests } from "#host/dispatchRequests.ts";
import { fleetStatus } from "#host/fleetStatus.ts";
import { reserveForeignPr } from "#host/foreignReservations.ts";
import { LiveConfig } from "#host/liveConfig.ts";
import { nameStoredThreads } from "#host/nameThreads.ts";
import { decisionResponses } from "#host/releaseWork.ts";
import { settleFinishedDecisions } from "#host/settleFinishedDecisions.ts";
import { watchBoardAnswers } from "#host/watchBoardAnswers.ts";

export const daemonHandlers = Effect.fn("FleetDaemon.daemonHandlers")(function* (host: FleetHost) {
	const scope = yield* Effect.scope;
	const url = Redacted.make(host.databaseUrl);
	const receiptContext = yield* Layer.buildWithScope(
		PgClient.layer({
			applicationName: "work-fleet-receipts",
			maxConnections: 1,
			url,
			...databaseAddress(url),
		}),
		scope,
	);
	const receipts = Context.get(receiptContext, SqlClient.SqlClient);
	function read<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.provideService(SqlClient.SqlClient, receipts));
	}
	const follow = yield* read(daemonSnapshots(host));
	const watchSnapshots = yield* read(daemonSnapshots(host, true));
	const epoch = crypto.randomUUID();
	const boardAnswers = yield* watchBoardAnswers(host.boardDir).pipe(
		Stream.map((snapshot) => ({ ...snapshot, epoch })),
		Stream.mapError((error) => new ServiceUnavailable({ message: error.message })),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	function watch(workIds: readonly string[]) {
		return watchSnapshots(workIds, true).pipe(
			Stream.map((states) => ({ epoch, states })),
			Stream.merge(boardAnswers),
			Stream.merge(Stream.tick("1 second").pipe(Stream.map(() => ({ epoch }))), { haltStrategy: "left" }),
		);
	}
	const diagnostics = yield* daemonDiagnostics;
	const dispatch = yield* dispatchRequests(host);
	const live = yield* LiveConfig;
	const status = Effect.zipWith(read(fleetStatus(host)), live.current, (views, applied) => ({ ...views, config: configStatus(applied) }));
	// Start Board observation beside the handlers so startup does not wait for its initial scan.
	const responses = yield* Layer.buildWithScope(decisionResponses(host), scope).pipe(Effect.forkIn(scope));
	function withResponses<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Fiber.join(responses).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))));
	}
	const answers = yield* answerRequests(
		host,
		(workId, options) => withResponses(answerWork(host, workId, { ...options, background: true })),
		receipts,
	);
	const acceptRelease = Effect.fn("FleetDaemon.acceptRelease")(function* (workId: string) {
		const current = (yield* read(answerRecords(host.namespace, workId)))[0];
		if (current === undefined) {
			return yield* new NotFound({ message: `Unknown Board work ${workId}` });
		}
		if (current.step === "released") {
			return current;
		}
		if (current.step !== "waiting") {
			return yield* new Forbidden({
				message: `Only waiting work can be released; use work-fleet stop ${workId} to interrupt running work`,
			});
		}
		return yield* answers(workId, "Release Fleet ownership.", true);
	});
	// A client that stops waiting closes its request; the answer it asked for must still be recorded and applied.
	function settle<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.forkIn(scope), Effect.flatMap(Fiber.join));
	}
	const stop = Effect.fn("FleetDaemon.stop")(function* (workId: string) {
		const fleet = yield* Fleet;
		yield* fleet.stop(workId);
		return (yield* answerWork(host, workId, { release: true })).value;
	});
	return Layer.merge(
		diagnostics,
		ClientContract.application.toLayer(
			Effect.succeed(
				ClientContract.application.of({
					"daemon.answer": ({ workId, text, release }) => exposeFailure(settle(answers(workId, text, release))),
					"daemon.check-stuck": ({ workId }) => exposeFailure(checkStuck(workId)),
					"daemon.close-finished-decisions": ({ dryRun }) => exposeFailure(settle(settleFinishedDecisions(host.namespace, dryRun))),
					"daemon.dispatch": ({ workId, now, ignoreAreas }) => exposeFailure(dispatch.accept(workId, { ignoreAreas, now })),
					"daemon.dispatch-status": ({ workId }) => exposeFailure(dispatch.get(workId)),
					"daemon.follow": ({ workIds, follow: continuous }) => follow(workIds, continuous),
					"daemon.name-threads": () => exposeFailure(nameStoredThreads(host)),
					"daemon.release": ({ workIds }) => exposeFailure(settle(Effect.forEach(workIds, acceptRelease))),
					"daemon.reserve-pr": ({ areas, pr }) => exposeFailure(settle(reserveForeignPr(host, pr, areas))),
					"daemon.status": ({ workId }) => exposeFailure(workId === undefined ? status : read(fleetStatus(host, workId))),
					"daemon.stop": ({ workId }) => exposeFailure(settle(withResponses(stop(workId)))),
					"daemon.watch": ({ workIds }) => watch(workIds),
				}),
			),
		),
	);
});
