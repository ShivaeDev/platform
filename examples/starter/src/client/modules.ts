import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { connectModules } from "./Module.ts";

const modules = [foundationRegistration, notesRegistration] as const;

export function clientModules() {
	return connectModules(modules.map((module) => module()));
}
