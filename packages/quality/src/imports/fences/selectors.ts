import type { External, Selector, Target } from "./model.ts";

function target(selector: Selector): Target {
	return { except: (...excluded) => target({ base: selector, excluded: excluded.map((member) => member.selector), kind: "except" }), selector };
}

export function packages(...names: readonly string[]): Target {
	return target({ kind: "packages", names });
}

export function folders(...paths: readonly string[]): Target {
	return target({ kind: "folders", paths });
}

export function files(...paths: readonly string[]): Target {
	return target({ kind: "files", paths });
}

export function modules(...names: readonly string[]): Target {
	return target({ kind: "modules", names });
}

export function scopes(...names: readonly string[]): Target {
	return target({ kind: "scopes", names });
}

export function anyOf(...members: readonly Target[]): Target {
	return target({ kind: "anyOf", members: members.map((member) => member.selector) });
}

export const workspace: Target = target({ kind: "workspace" });

export const anything: Target = target({ kind: "anything" });

export function external(specifier: string): External {
	return { external: specifier };
}
