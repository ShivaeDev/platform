import type { AnyRoute } from "@tanstack/react-router";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { type ClientModule, connectModules } from "./Module.ts";

const modules = [notesRegistration] as const;

function connect<TRoute extends AnyRoute = never>(factories: readonly (() => ClientModule<TRoute>)[]) {
	return connectModules(factories.map((module) => module()));
}

export function clientModules() {
	return connect(modules);
}
