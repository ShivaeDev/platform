import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

export interface BindingOwner {
	readonly registry: AtomRegistry.AtomRegistry;
}

export function bindingOwner(scope: "session" | undefined, registry?: AtomRegistry.AtomRegistry): BindingOwner | undefined {
	if (scope === undefined) {
		return undefined;
	}
	if (registry === undefined) {
		throw new Error("A session-scoped contract requires its owning registry");
	}
	return { registry };
}
