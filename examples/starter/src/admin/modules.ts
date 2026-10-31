import { mergeAdminRegistries } from "@shivaedev/admin/registry.ts";
import { Admin as notesModule } from "#modules/notes/admin/pages.ts";
import { noteQueue } from "#modules/notes/queue.ts";
import { foundationPages } from "./foundationPages.ts";

const modules = [notesModule] as const;
const queues = [noteQueue] as const;

export const foundation = foundationPages(...queues);
export const Admin = mergeAdminRegistries(foundation.admin, ...modules);
