import { Effect, Layer } from "effect";
import { FleetRepository, fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { BoardFailure, type BoardGateway, type FleetConfiguration, FleetPolicy, type Priority } from "#policy.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { attentionStorage } from "#test/attentionStorage.ts";
import { boardWork } from "#test/boardWork.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineFixture } from "#test/engine.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { scriptedBoard } from "#test/scriptedBoard.ts";

export const createEngine = Effect.fn("FleetFixture.createEngine")(function* <TBoardError = never>(
	options: EngineOptions,
	boardOverride?: Layer.Layer<BoardGateway, TBoardError>,
) {
	const namespace = STORAGE_NAMESPACE;
	const originalStore = yield* FleetRepository.pipe(Effect.provide(postgresFleetRepository(namespace)));
	const { replaceRecord, store, upgradeAttention, upgradeDecisionCodes } = yield* attentionStorage(
		originalStore,
		namespace,
		options.writeGate,
		options.writeFailure,
	);
	const reviews: string[] = [];
	const provider = engineProvider(options, reviews);
	const revisions = new Map<string, string>();
	const dependencies = new Map<string, readonly string[]>();
	const areas = new Map<string, readonly string[]>();
	const statuses = new Map<string, string>();
	const priorities = new Map<string, Priority>();
	const unavailable = new Set<string>();
	const approved: Record<string, string> = { dependent: "board-dependent", one: "board-one", two: "board-two" };
	const decisions: string[] = [];
	const merged: string[] = [];
	const policy = enginePolicy(options);
	const scripted = scriptedBoard(options, decisions, (id) =>
		unavailable.has(id)
			? Effect.fail(new BoardFailure({ message: "Board work unavailable" }))
			: Effect.succeed(boardWork(id, approved, revisions, dependencies, areas, statuses, priorities)),
	);
	const base = Layer.mergeAll(Layer.succeed(FleetRepository)(store), boardOverride ?? scripted.layer, provider.transport);
	const session = SessionService.layer.pipe(Layer.provide(Layer.merge(base, fleetSessionJournal.pipe(Layer.provide(base)))));
	const integrations = engineIntegrations(options, merged);
	function fleetLayer(configuration = policy) {
		return Fleet.layer.pipe(Layer.provide(Layer.mergeAll(base, session, integrations, Layer.succeed(FleetPolicy)(configuration))));
	}
	function foreign(owner: string) {
		return store.reserveForeign(owner, { backlog: true, executing: false });
	}
	if (options.foreignBacklog) {
		yield* foreign("foreign-pr");
	}
	const journal = yield* SessionJournal.pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(base))));
	const fixture: EngineFixture<TBoardError> = {
		...provider,
		acknowledgementAttempts: scripted.acknowledgementAttempts,
		acknowledgements: scripted.acknowledgements,
		acknowledgeTurn: journal.acknowledgeTurn,
		approveWork: (workId: string, revision: string) => {
			approved[workId] = revision;
		},
		areas: (workId, names) => {
			areas.set(workId, names);
		},
		boardStatus: (workId, status) => {
			statuses.set(workId, status);
		},
		decisions,
		dependencies: (workId: string, references: readonly string[]) => {
			dependencies.set(workId, references);
		},
		editWork: (workId: string, revision: string) => {
			revisions.set(workId, revision);
		},
		foreign,
		foreignReservations: store.foreignReservations,
		merged,
		occupy: (owner) => store.reserveForeign(owner, { backlog: false, executing: true }),
		priority: (workId, value) => {
			priorities.set(workId, value);
		},
		replaceRecord,
		respond: scripted.respond,
		restart: <TResult, TFailure>(
			effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>,
			configure?: (policy: FleetConfiguration) => FleetConfiguration,
		) => effect.pipe(Effect.provide(Layer.fresh(fleetLayer(configure?.(policy) ?? policy)))),
		reviews,
		sessionName: (operationId) => journal.sessionName?.(operationId) ?? Effect.die("Missing journal naming implementation"),
		unavailableWork: (workId: string, value: boolean) => {
			if (value) {
				unavailable.add(workId);
			} else {
				unavailable.delete(workId);
			}
		},
		upgradeAttention,
		upgradeDecisionCodes,
		vacate: store.releaseForeign,
		work: (id: string) => boardWork(id, approved, revisions, dependencies, areas, statuses, priorities),
	};
	return {
		fixture,
		layer: fleetLayer(),
		restartLayer: (configure?: (policy: FleetConfiguration) => FleetConfiguration) => Layer.fresh(fleetLayer(configure?.(policy) ?? policy)),
	};
});
