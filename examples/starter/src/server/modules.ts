import type { Layer } from "effect";
import { appModules } from "@shivaedev/server/appModules.ts";
import { modules } from "#generated/server/modules.ts";
import { serverRegistration } from "#server/registration.ts";

export function serverModules<R = never, E = never, TRequirements = never>(replacements: Layer.Layer<R, E, TRequirements>) {
	return appModules([serverRegistration(modules), ...modules], { replacements });
}
