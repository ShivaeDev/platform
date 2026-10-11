import type { FleetConfiguration } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function enginePolicy(options: EngineOptions): FleetConfiguration {
	let operationCount = 0;
	return {
		deliveryBacklog: options.backlog ?? 2,
		executionConcurrency: options.concurrency ?? 2,
		...(options.launch === undefined ? {} : { launch: options.launch }),
		now: options.now ?? (() => 100),
		operationId: () => {
			operationCount += 1;
			return options.operationCollision ? "operation-fixed" : `operation-${operationCount}`;
		},
		quota: {
			...(options.unknownQuota ? {} : { available: options.quota ?? 100 }),
			expiresAt: options.now === undefined ? 1000 : 10_000_000,
			observedAt: 0,
		},
	};
}
