import { Effect } from "effect";
import { NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { type AttentionOwner, waitingOwner } from "#attention.ts";
import type { DecisionCode } from "#DecisionCode.ts";
import { originalWork } from "#engine/originalWork.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { BoardGateway, type BoardWork, type Decision, type FleetConfiguration, FleetIntegrations, FleetPolicy } from "#policy.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS } from "#scheduling/areas.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { SessionService } from "#session/service.ts";
import type { AdmissionLimits, Versioned } from "#storage/model.ts";
export interface LaunchAdmission {
	readonly areaWaiters: readonly string[];
	readonly ignoreAreas?: boolean;
	readonly implementer?: boolean;
	readonly overLimit?: boolean;
	readonly quota: FleetConfiguration["quota"];
	readonly role: Attempt["role"];
}
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
	const current = policy.current ?? Effect.succeed(policy);
	function save(stored: Versioned<FleetRecord>, value: FleetRecord, admission?: LaunchAdmission) {
		const record = { ...value, attentionOwner: waitingOwner(value) };
		if (admission === undefined) {
			return store.compareAndSet(value.workId, stored.version, record);
		}
		return Effect.flatMap(current, (applied) => store.compareAndSet(value.workId, stored.version, record, launchLimits(applied, admission)));
	}
	const decision = Effect.fn("Fleet.decision")(function* (
		stored: Versioned<FleetRecord>,
		code: DecisionCode,
		reason: string,
		recommendation: string,
		worker?: SessionReceipt,
		attentionOwner: AttentionOwner = "orchestrator",
		publicationWork?: BoardWork,
	) {
		const value: Decision = {
			attentionOwner,
			code,
			id: `${stored.value.workId}.${stored.version}`,
			...(publicationWork === undefined ? {} : { publicationWork }),
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
		const published = yield* board.decision(stored.value.workId, value, publicationWork ?? originalWork(stored.value));
		return yield* save(updated, { ...updated.value, decision: { ...value, published }, decisionPublished: true });
	});
	return { board, current, decision, integrations, launching, launchScope, load, policy, reportInspection, save, sessions, store };
});
export type EngineState = Effect.Success<typeof makeState>;

function launchLimits(policy: FleetConfiguration, admission: LaunchAdmission): AdmissionLimits {
	const concurrency = admission.overLimit ? undefined : policy.executionConcurrency;
	return {
		...(admission.ignoreAreas
			? {}
			: {
					scheduling: {
						areaMergeWaitMs: policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS,
						now: policy.now(),
						waiters: admission.areaWaiters,
					},
				}),
		...(admission.quota.available === undefined ? {} : { quota: { available: admission.quota.available, observedAt: admission.quota.observedAt } }),
		...(concurrency === undefined ? {} : { maxExecuting: concurrency }),
		...(admission.role !== "worker" || admission.overLimit || policy.deliveryBacklog === undefined ? {} : { maxBacklog: policy.deliveryBacklog }),
		...(concurrency === undefined || !admission.implementer
			? {}
			: { implementers: { concurrency, ...(policy.openPullRequests === undefined ? {} : { openPullRequests: policy.openPullRequests }) } }),
	};
}
