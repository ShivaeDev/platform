import { Effect, Layer } from "effect";
import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import { FleetRepository, fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure, type BoardGateway, type BoardWork, type FleetConfiguration, FleetPolicy, type Priority } from "#policy.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import type { ForeignReservation } from "#storage/model.ts";
import { attentionStorage } from "#test/attentionStorage.ts";
import { boardWork } from "#test/boardWork.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { prepared } from "#test/preparation.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { scriptedBoard } from "#test/scriptedBoard.ts";
export interface EngineFixture<TBoardError = never> extends Omit<EngineProvider, "transport"> {
	readonly acknowledgementAttempts: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgements: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgeTurn: (operationId: string, receipt: { readonly sessionId: string; readonly turnId: string }) => Effect.Effect<void, unknown>;
	readonly approveWork: (workId: string, revision: string) => void;
	readonly areas: (workId: string, areas: readonly string[]) => void;
	readonly boardStatus: (workId: string, status: string) => void;
	readonly decisions: readonly string[];
	readonly dependencies: (workId: string, references: readonly string[]) => void;
	readonly editWork: (workId: string, revision: string) => void;
	readonly foreign: (owner: string, occupancy?: Omit<ForeignReservation, "owner">) => Effect.Effect<void, unknown>;
	readonly foreignReservations: () => Effect.Effect<readonly ForeignReservation[], unknown>;
	readonly merged: readonly string[];
	readonly occupy: (owner: string) => Effect.Effect<void, unknown>;
	readonly priority: (workId: string, priority: Priority) => void;
	readonly replaceRecord: (value: FleetRecord) => Effect.Effect<void, unknown>;
	readonly respond: (decisionId: string, action: "retry" | "release", type?: "answer" | "clarify" | "not_now") => string;
	readonly restart: <TResult, TFailure>(
		effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>,
		configure?: (policy: FleetConfiguration) => FleetConfiguration,
	) => Effect.Effect<TResult, TFailure | TBoardError>;
	readonly reviews: readonly string[];
	readonly sessionName: (operationId: string) => Effect.Effect<string, unknown>;
	readonly unavailableWork: (workId: string, unavailable: boolean) => void;
	readonly upgradeAttention: Effect.Effect<void, unknown>;
	readonly upgradeDecisionCodes: Effect.Effect<void, unknown>;
	readonly vacate: (owner: string) => Effect.Effect<void, unknown>;
	readonly work: (id: string) => BoardWork;
}
export const makeEngine = Effect.fn("FleetFixture.makeEngine")(function* <TBoardError = never>(
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
	function foreign(owner: string, occupancy = { backlog: true, executing: false }) {
		return store.reserveForeign(owner, occupancy);
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
	return { fixture, layer: fleetLayer() };
});

export const withEngine = Effect.fn("FleetFixture.withEngine")(function* <A, E, TBoardError = never>(
	options: EngineOptions,
	use: (fixture: EngineFixture<TBoardError>) => Effect.Effect<A, E, typeof Fleet.Identifier>,
	boardOverride?: Layer.Layer<BoardGateway, TBoardError>,
) {
	const { fixture, layer } = yield* makeEngine(options, boardOverride);
	return yield* use(fixture).pipe(Effect.provide(layer));
});

export const prepareWork = Effect.fn("Fleet.prepareWork")(function* (workId: string) {
	const fleet = yield* Fleet;
	return yield* fleet.prepare({
		cwd: "/synthetic",
		preparation: prepared({ ownedPaths: [`src/${workId}.ts`], sourcePaths: [`src/${workId}.ts`] }),
		prompt: `Implement ${workId}`,
		workId,
	});
});
export function finishWorkers(fixture: Pick<EngineFixture, "observations">) {
	for (const [key, value] of fixture.observations) {
		fixture.observations.set(key, { ...value, execution: "completed" });
	}
}
