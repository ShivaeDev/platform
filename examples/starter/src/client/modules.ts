import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { type ClientModule, connectModules } from "./Module.ts";

const modules: readonly (() => ClientModule)[] = [notesRegistration];

export function clientModules() {
	return connectModules(modules.map((module) => module()));
}
