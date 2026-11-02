import type { Layer } from "effect";
import { appModules } from "@shivaedev/server/appModules.ts";
import { notesRegistration } from "#modules/notes/server/registration.ts";
import { serverRegistration } from "#server/registration.ts";

const modules = [serverRegistration(notesRegistration.queues.filter((queue) => queue._tag === "QueueDefinition")), notesRegistration] as const;

export function serverModules<R = never, E = never, TRequirements = never>(replacements: Layer.Layer<R, E, TRequirements>) {
	return appModules(modules, { replacements });
}
