import { Effect } from "effect";
import { NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { type AttentionOwner, waitingOwner } from "#attention.ts";
import type { DecisionCode } from "#DecisionCode.ts";
import { originalWork } from "#engine/originalWork.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { BoardGateway, type Decision, FleetIntegrations, FleetPolicy } from "#policy.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS } from "#scheduling/areas.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { SessionService } from "#session/service.ts";
import type { Versioned } from "#storage/model.ts";
export const makeState = Effect.gen(function* () {
	const store = yield* FleetRepository;
	const board = yield* BoardGateway;
	const policy = yield* FleetPolicy;
	const integrations = yield* FleetIntegrations;
	const sessions = yield* SessionService;
	const reportInspection = yield* Effect.serviceOption(ReportInspection);
	const launchScope = yield* Effect.scope;
	const launching = new Set<string>();
	function load(workId: string) {
		return store
			.load(workId)
			.pipe(
				Effect.flatMap((stored) =>
					stored === undefined ? Effect.fail(new NotFound({ message: `Unknown Board work ${workId}` })) : Effect.succeed(stored),
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
			{ ...value, attentionOwner: waitingOwner(value) },
			admission === undefined
				? undefined
				: {
						scheduling: { areaMergeWaitMs: policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS, now: policy.now() },
						...(admission.quota.available === undefined
							? {}
							: { quota: { available: admission.quota.available, observedAt: admission.quota.observedAt } }),
						...(policy.executionConcurrency === undefined ? {} : { maxExecuting: policy.executionConcurrency }),
						...(admission.role !== "worker" || policy.deliveryBacklog === undefined ? {} : { maxBacklog: policy.deliveryBacklog }),
					},
		);
	}
	const decision = Effect.fn("Fleet.decision")(function* (
		stored: Versioned<FleetRecord>,
		code: DecisionCode,
		reason: string,
		recommendation: string,
		worker?: SessionReceipt,
		attentionOwner: AttentionOwner = "orchestrator",
	) {
		const value: Decision = {
			attentionOwner,
			code,
			id: `${stored.value.workId}.${stored.version}`,
			links: stored.value.result?.kind === "change" ? [stored.value.result.pr] : [],
			reason,
			recommendation,
			...(worker === undefined ? {} : { worker }),
		};
		const updated = yield* save(stored, {
			...stored.value,
			attentionOwner,
			blocker: undefined,
			decision: value,
			decisionPublished: false,
			launchRetry: undefined,
			stage: "needs-human",
		});
		const published = yield* board.decision(stored.value.workId, value, originalWork(stored.value));
		return yield* save(updated, { ...updated.value, decision: { ...value, published }, decisionPublished: true });
	});
	return { board, decision, integrations, launching, launchScope, load, policy, reportInspection, save, sessions, store };
});
export type EngineState = Effect.Success<typeof makeState>;
