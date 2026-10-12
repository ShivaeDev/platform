import { Effect, Layer } from "effect";
import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { allAttempts, backlog, executing, FleetRecord } from "#model.ts";
import { BoardFailure, type BoardGateway, type BoardWork, type FleetConfiguration, FleetPolicy } from "#policy.ts";
import { checkAreas, needsAreaRecords, requeue } from "#scheduling/areas.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { ForeignReservation } from "#storage/model.ts";
import { attentionStorage } from "#test/attentionStorage.ts";
import { boardWork } from "#test/boardWork.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { prepared } from "#test/preparation.ts";
import { scriptedBoard } from "#test/scriptedBoard.ts";
import { withStorage } from "#test/storage.ts";
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
	readonly foreign: (owner: string) => Effect.Effect<void, unknown>;
	readonly foreignReservations: () => Effect.Effect<readonly ForeignReservation[], unknown>;
	readonly merged: readonly string[];
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
	readonly work: (id: string) => BoardWork;
}
export function withEngine<A, E, TBoardError = never>(
	options: EngineOptions,
	use: (fixture: EngineFixture<TBoardError>) => Effect.Effect<A, E, typeof Fleet.Identifier>,
	boardOverride?: Layer.Layer<BoardGateway, TBoardError>,
) {
	return withStorage((_unused, namespace) =>
		Effect.gen(function* () {
			const originalStore = yield* makePostgresFleetStore(FleetRecord, {
				admission: checkAreas,
				admissionNeedsRecords: needsAreaRecords,
				backlog,
				executing,
				namespace,
				requeue,
				submissions: (record, since) => allAttempts(record).filter((attempt) => attempt.submittedAt >= since).length,
			});
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
			const unavailable = new Set<string>();
			const approved: Record<string, string> = { dependent: "board-dependent", one: "board-one", two: "board-two" };
			const decisions: string[] = [];
			const merged: string[] = [];
			const policy = enginePolicy(options);
			const scripted = scriptedBoard(options, decisions, (id) =>
				unavailable.has(id)
					? Effect.fail(new BoardFailure({ message: "Board work unavailable" }))
					: Effect.succeed(boardWork(id, approved, revisions, dependencies, areas, statuses)),
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
				work: (id: string) => boardWork(id, approved, revisions, dependencies, areas, statuses),
			};
			return yield* use(fixture).pipe(Effect.provide(fleetLayer()));
		}),
	);
}
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
