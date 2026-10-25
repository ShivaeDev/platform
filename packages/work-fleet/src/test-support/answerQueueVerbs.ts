import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import { finishWorkers } from "#test/engine.ts";

export function answerQueueVerbs(engine: AnswerHostEngine) {
	return {
		finishWorkers: () => {
			if (engine.host.provider.observations.size === 0) {
				throw new Error("Dispatch a worker before completing its turns");
			}
			finishWorkers(engine.host.provider);
		},
		writeBoard: (path: string, source: string) => engine.host.write(path, source),
	};
}
