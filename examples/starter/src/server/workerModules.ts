import { Layer } from "effect";
import { notesWorker } from "#modules/notes/server/worker.ts";
import { AuthEmailQueue } from "./AuthEmailQueue.ts";
import { foundationWorker } from "./foundationWorker.ts";

export const workerModules = Layer.mergeAll(foundationWorker, notesWorker, AuthEmailQueue.workerLayer);
