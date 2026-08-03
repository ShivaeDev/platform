import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "effect";

export interface ContextBridge {
	readonly current: () => Context.Context<never> | undefined;
	readonly run: <Services, Value>(
		services: Context.Context<Services>,
		evaluate: () => Value,
	) => Value;
}

export const makeContextBridge = (shared?: {
	readonly currentServices?: ContextBridge["current"];
	readonly runWithServices?: ContextBridge["run"];
}): ContextBridge => {
	if (
		shared?.currentServices !== undefined &&
		shared.runWithServices !== undefined
	) {
		return {
			current: shared.currentServices,
			run: shared.runWithServices,
		};
	}

	const storage = new AsyncLocalStorage<Context.Context<never>>();

	return {
		current: () => storage.getStore(),
		run: (services, evaluate) =>
			storage.run(services as Context.Context<never>, evaluate),
	};
};
