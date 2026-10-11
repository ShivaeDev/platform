import type { FleetConfiguration } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function enginePolicy(options: EngineOptions): FleetConfiguration {
	let operationCount = 0;
	return {
		...(options.areaMergeWaitMs === undefined ? {} : { areaMergeWaitMs: options.areaMergeWaitMs }),
		deliveryBacklog: options.backlog ?? 2,
		executionConcurrency: options.concurrency ?? 2,
		...(options.launch === undefined ? {} : { launch: options.launch }),
		now: options.now ?? (() => 100),
		operationId: () => {
			operationCount += 1;
			return options.operationCollision ? "operation-fixed" : `operation-${operationCount}`;
		},
		quota: { ...(options.unknownQuota ? {} : { available: options.quota ?? 100 }), expiresAt: Number.MAX_SAFE_INTEGER, observedAt: 0 },
		...(options.reviewerGuidance === undefined ? {} : { reviewerGuidance: options.reviewerGuidance }),
	};
}
