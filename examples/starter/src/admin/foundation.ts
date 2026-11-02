import { noteQueue } from "#modules/notes/queue.ts";
import { foundationPages } from "./foundationPages.ts";
import { foundationQueues } from "./foundationQueues.ts";

export const foundation = foundationPages(...foundationQueues, noteQueue);
