import type { EngineOptions } from "#test/EngineOptions.ts";

export function singleWorkerWithHumanDeliveryConfiguration() {
	return (): EngineOptions => ({ concurrency: 1, denyDelivery: true });
}
