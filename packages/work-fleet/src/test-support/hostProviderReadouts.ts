import { finishWorkers } from "#test/engine.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostProviderReadouts(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		finishWorkers: () => {
			tell("the provider finishes every worker turn");
			if (engine.observedProvider.observations.size === 0) {
				throw new Error("No worker is available to finish");
			}
			finishWorkers(engine.observedProvider);
		},
		providerArchives: () => [...engine.observedProvider.archived],
		providerLaunches: () => [...engine.observedProvider.launched],
		providerObservations: () => [...engine.observedProvider.observations.values()],
	};
}
