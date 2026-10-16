import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { operationRecord } from "#engine/operationRecord.ts";
import { threadName } from "#engine/threadNames.ts";
import { type Attempt, allAttempts, backlog, executing, FleetRecord } from "#model.ts";
import { checkAreas, needsAreaRecords, requeue } from "#scheduling/areas.ts";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";
import { SessionJournal } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";

type Store = Effect.Success<ReturnType<typeof makePostgresFleetStore<typeof FleetRecord>>>;
export class FleetRepository extends Context.Service<
	FleetRepository,
	Omit<Store, "initialize" | "operationEntries"> & Partial<Pick<Store, "operationEntries">>
>()("@shivaedev/work-fleet/FleetRepository") {}
class RepositoryNamespace extends Context.Service<RepositoryNamespace, string | undefined>()("Fleet/RepositoryNamespace") {}
const PostgresFleetRepository = defineService({
	id: "Fleet/PostgresFleetRepository",
	initialize: Effect.gen(function* () {
		const namespace = yield* RepositoryNamespace;
		const store = yield* makePostgresFleetStore(FleetRecord, {
			admission: checkAreas,
			admissionNeedsRecords: needsAreaRecords,
			backlog,
			executing,
			requeue,
			submissions: (record, since) => allAttempts(record).filter((attempt) => attempt.submittedAt >= since).length,
			...(namespace === undefined ? {} : { namespace }),
		});
		return store;
	}),
	methods: ({ initialize: _initialize, ...methods }) => methods,
	requires: [SqlClient.SqlClient, RepositoryNamespace],
});

export function postgresFleetRepository(namespace?: string) {
	return Layer.effect(FleetRepository)(PostgresFleetRepository).pipe(
		Layer.provide(PostgresFleetRepository.layer.pipe(Layer.provide(Layer.succeed(RepositoryNamespace, namespace)))),
	);
}
const FleetSessionJournal = defineService({
	id: "Fleet/SessionJournal",
	initialize: Effect.gen(function* () {
		const store = yield* FleetRepository;
		const namingWork = new Map<string, string>();
		function acknowledge(
			operationId: string,
			sessionId: string,
			receipt?: {
				readonly sessionId: string;
				readonly turnId: string;
			},
		) {
			return Effect.gen(function* () {
				const stored = yield* operationRecord(store, operationId);
				if (stored === undefined) {
					return yield* Effect.fail(new SessionFailure({ message: "Submission intent was not persisted", reason: "persistence" }));
				}
				const original = stored.value.attempts.find((attempt) => attempt.operationId === operationId);
				if (
					original === undefined
					|| original.abandoned !== undefined
					|| (original.sessionId === undefined && original.status !== "submitting")
					|| (original.role === "reviewer"
						&& allAttempts(stored.value).some((attempt) => attempt.role !== "reviewer" && attempt.sessionId === sessionId))
					|| (original.sessionId !== undefined && original.sessionId !== sessionId)
					|| (receipt !== undefined
						&& original.receipt !== undefined
						&& (original.receipt.sessionId !== receipt.sessionId || original.receipt.turnId !== receipt.turnId))
				) {
					return yield* Effect.fail(
						new SessionFailure({
							message: "Independent review or submission acknowledgement conflicts with the persisted exact receipt",
							reason: "persistence",
						}),
					);
				}
				const attempts = stored.value.attempts.map((attempt) => acknowledgedAttempt(attempt, operationId, sessionId, receipt));
				yield* store.compareAndSet(stored.value.workId, stored.version, { ...stored.value, attempts });
				rememberNamingWork(namingWork, stored.value, operationId, sessionId, receipt);
			}).pipe(
				Effect.mapError((error) =>
					error instanceof SessionFailure
						? error
						: new SessionFailure({ message: "Receipt persistence failed; reconcile the existing operation", reason: "persistence" }),
				),
			);
		}
		return { acknowledge, namingWork, store };
	}),
	methods: ({ acknowledge, namingWork, store }) =>
		SessionJournal.of({
			acknowledgeSession: (operationId: string, sessionId: string) => acknowledge(operationId, sessionId),
			acknowledgeTurn: (
				operationId: string,
				receipt: {
					readonly sessionId: string;
					readonly turnId: string;
				},
			) => acknowledge(operationId, receipt.sessionId, receipt),
			sessionName: (operationId: string) =>
				Effect.gen(function* () {
					const workId = namingWork.get(operationId);
					namingWork.delete(operationId);
					const stored = workId === undefined ? undefined : yield* store.load(workId);
					return yield* operationThreadName(stored?.value, operationId);
				}).pipe(Effect.mapError((error) => new SessionFailure({ message: error.message, reason: "persistence" }))),
		}),
	requires: [FleetRepository],
});
export const fleetSessionJournal = Layer.effect(SessionJournal)(FleetSessionJournal).pipe(Layer.provide(FleetSessionJournal.layer));

function rememberNamingWork(work: Map<string, string>, record: FleetRecord, operationId: string, sessionId: string, receipt?: SessionReceipt) {
	const continued = allAttempts(record).some((attempt) => attempt.operationId !== operationId && attempt.sessionId === sessionId);
	if (receipt === undefined && !continued) {
		work.set(operationId, record.workId);
	} else {
		work.delete(operationId);
	}
}

function operationThreadName(record: FleetRecord | undefined, operationId: string) {
	const matches =
		record === undefined
			? []
			: record.attempts
					.filter((attempt) => attempt.operationId === operationId)
					.map((attempt) => threadName(record.workId, record.boardContext, attempt.role));
	const [name] = matches;
	return matches.length === 1 && name !== undefined
		? Effect.succeed(name)
		: Effect.fail(new SessionFailure({ message: "Submission intent is missing or ambiguous", reason: "persistence" }));
}

function acknowledgedAttempt(attempt: Attempt, operationId: string, sessionId: string, receipt?: SessionReceipt): Attempt {
	if (attempt.operationId !== operationId) {
		return attempt;
	}
	if (receipt === undefined) {
		return { ...attempt, sessionId };
	}
	return { ...attempt, receipt, sessionId, status: attempt.status === "submitting" ? "accepted" : attempt.status };
}
