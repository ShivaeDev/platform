import { Effect } from "effect";
import { FleetRepository } from "#engine/repository.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { BoardGateway, type Decision, FleetFailure, FleetIntegrations, FleetPolicy } from "#policy.ts";
import { SessionService } from "#session/service.ts";
import type { Versioned } from "#storage/model.ts";
export const makeState = Effect.gen(function* () {
	const store = yield* FleetRepository;
	const board = yield* BoardGateway;
	const policy = yield* FleetPolicy;
	const integrations = yield* FleetIntegrations;
	const sessions = yield* SessionService;
	function load(workId: string) {
		return store
			.load(workId)
			.pipe(
				Effect.flatMap((stored) =>
					stored === undefined
						? Effect.fail(new FleetFailure({ message: `Unknown Board work ${workId}`, reason: "missing" }))
						: Effect.succeed(stored),
				),
			);
	}
	function save(
		stored: Versioned<FleetRecord>,
		value: FleetRecord,
		admission?: {
			readonly role: Attempt["role"];
			readonly quota: typeof policy.quota;
		},
	) {
		return store.compareAndSet(
			value.workId,
			stored.version,
			value,
			admission === undefined
				? undefined
				: {
						...(admission.quota.available === undefined
							? {}
							: { quota: { available: admission.quota.available, observedAt: admission.quota.observedAt }, recheckOwnership: true }),
						...(policy.executionConcurrency === undefined ? {} : { maxExecuting: policy.executionConcurrency }),
						...(admission.role !== "worker" || policy.deliveryBacklog === undefined ? {} : { maxBacklog: policy.deliveryBacklog }),
					},
		);
	}
	const decision = Effect.fn("Fleet.decision")(function* (stored: Versioned<FleetRecord>, reason: string, recommendation: string) {
		const value: Decision = {
			id: `${stored.value.workId}.${stored.version}`,
			links: stored.value.result?.kind === "change" ? [stored.value.result.pr] : [],
			reason,
			recommendation,
		};
		const updated = yield* save(stored, { ...stored.value, decision: value, decisionPublished: false, stage: "needs-human" });
		yield* board.decision(stored.value.workId, value);
		return yield* save(updated, { ...updated.value, decisionPublished: true });
	});
	return { board, decision, integrations, load, policy, save, sessions, store };
});
export type EngineState = Effect.Success<typeof makeState>;
