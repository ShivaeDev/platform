import { foundationPages } from "#admin/foundationPages.ts";
import { foundationQueues } from "#admin/foundationQueues.ts";
import { noteQueue } from "#modules/notes/queue.ts";

export const foundation = foundationPages(...foundationQueues, noteQueue);
