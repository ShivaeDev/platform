import { Effect, Layer } from "effect";
import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { allAttempts, backlog, executing, FleetRecord, owns, reservations } from "#model.ts";
import { BoardFailure, type BoardGateway, type BoardWork, type FleetConfiguration, FleetPolicy } from "#policy.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { prepared } from "#test/preparation.ts";
import { scriptedBoard } from "#test/scriptedBoard.ts";
import { withStorage } from "#test/storage.ts";
export interface EngineFixture<TBoardError = never> extends Omit<EngineProvider, "transport"> {
	readonly acknowledgementAttempts: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgements: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgeTurn: (operationId: string, receipt: { readonly sessionId: string; readonly turnId: string }) => Effect.Effect<void, unknown>;
	readonly approveWork: (workId: string, revision: string) => void;
	readonly decisions: readonly string[];
	readonly dependencies: (workId: string, references: readonly string[]) => void;
	readonly editWork: (workId: string, revision: string) => void;
	readonly foreign: (owner: string, paths: readonly string[]) => Effect.Effect<void, unknown>;
	readonly merged: readonly string[];
	readonly respond: (decisionId: string, action: "retry" | "release", type?: "answer" | "clarify" | "not_now") => string;
	readonly restart: <TResult, TFailure>(
		effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>,
	) => Effect.Effect<TResult, TFailure | TBoardError>;
	readonly reviews: readonly string[];
	readonly unavailableWork: (workId: string, unavailable: boolean) => void;
	readonly work: (id: string) => BoardWork;
}
function boardWork(
	id: string,
	revisions: ReadonlyMap<string, string> = new Map(),
	dependencies: ReadonlyMap<string, readonly string[]> = new Map(),
): BoardWork {
	return {
		context: `Work ${id}: ${revisions.get(id) ?? `board-${id}`}`,
		dependsOn: dependencies.get(id) ?? (id === "dependent" ? ["one"] : []),
		revision: revisions.get(id) ?? `board-${id}`,
		sourcePath: `board/${id}.md`,
		workId: id,
	};
}
export function withEngine<A, E, TBoardError = never>(
	options: EngineOptions,
	use: (fixture: EngineFixture<TBoardError>) => Effect.Effect<A, E, typeof Fleet.Identifier>,
	boardOverride?: Layer.Layer<BoardGateway, TBoardError>,
) {
	return withStorage((_unused, namespace) =>
		Effect.gen(function* () {
			const store = yield* makePostgresFleetStore(FleetRecord, {
				backlog,
				executing,
				namespace,
				owns,
				reservations,
				submissions: (record, since) => allAttempts(record).filter((attempt) => attempt.submittedAt >= since).length,
			});
			const provider = engineProvider(options);
			const revisions = new Map<string, string>();
			const dependencies = new Map<string, readonly string[]>();
			const unavailable = new Set<string>();
			const approved: Record<string, string> = { dependent: "board-dependent", one: "board-one", two: "board-two" };
			const decisions: string[] = [];
			const reviews: string[] = [];
			const merged: string[] = [];
			let operationCount = 0;
			const policy: FleetConfiguration = {
				approved,
				deliveryBacklog: options.backlog ?? 2,
				executionConcurrency: options.concurrency ?? 2,
				now: () => 100,
				operationId: () => {
					operationCount += 1;
					return options.operationCollision ? "operation-fixed" : `operation-${operationCount}`;
				},
				quota: { ...(options.unknownQuota ? {} : { available: options.quota ?? 100 }), expiresAt: 1000, observedAt: 0 },
			};
			const scripted = scriptedBoard(options, decisions, (id) =>
				unavailable.has(id)
					? Effect.fail(new BoardFailure({ message: "Board work unavailable" }))
					: Effect.succeed(boardWork(id, revisions, dependencies)),
			);
			const base = Layer.mergeAll(
				Layer.succeed(FleetRepository)(store),
				boardOverride ?? scripted.layer,
				Layer.succeed(FleetPolicy)(policy),
				provider.transport,
			);
			const session = SessionService.layer.pipe(Layer.provide(Layer.merge(base, fleetSessionJournal.pipe(Layer.provide(base)))));
			const integrations = engineIntegrations(options, provider, reviews, merged).pipe(Layer.provide(session));
			const fleetLayer = Fleet.layer.pipe(Layer.provide(Layer.mergeAll(base, session, integrations)));
			function foreign(owner: string, paths: readonly string[]) {
				return store.reserveForeign(owner, paths, { backlog: true, executing: false });
			}
			if (options.foreign !== undefined) {
				yield* foreign("foreign-pr", options.foreign);
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
				decisions,
				dependencies: (workId: string, references: readonly string[]) => {
					dependencies.set(workId, references);
				},
				editWork: (workId: string, revision: string) => {
					revisions.set(workId, revision);
				},
				foreign,
				merged,
				respond: scripted.respond,
				restart: <TResult, TFailure>(effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>) => effect.pipe(Effect.provide(fleetLayer)),
				reviews,
				unavailableWork: (workId: string, value: boolean) => {
					if (value) {
						unavailable.add(workId);
					} else {
						unavailable.delete(workId);
					}
				},
				work: (id: string) => boardWork(id, revisions, dependencies),
			};
			return yield* use(fixture).pipe(Effect.provide(fleetLayer));
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
