import { starterAt010, starterAt020 } from "#test/updateTraits.ts";

export const legacyWorkerRegistry = starterAt010("registers workers separately from application modules", {
	"src/server/workerModules.ts": `import { Layer } from "effect";
import { notesWorker } from "#modules/notes/server/worker.ts";
import { AuthEmailQueue } from "./AuthEmailQueue.ts";
import { foundationWorker } from "./foundationWorker.ts";

export const workerModules = Layer.mergeAll(foundationWorker, notesWorker, AuthEmailQueue.workerLayer);
`,
});

export const moduleWorkers = starterAt020("moves workers into application modules", { "src/server/workerModules.ts": null });
