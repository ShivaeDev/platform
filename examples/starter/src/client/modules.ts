import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { connectModules } from "./Module.ts";

const modules = [notesRegistration];

export function clientModules() {
	return connectModules(modules.map((module) => module()));
}
