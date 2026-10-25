import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { KeyContext } from "#keys.ts";

export interface BindingOwner {
	readonly context: KeyContext;
	readonly registry: AtomRegistry.AtomRegistry;
}

const contexts = new WeakMap<AtomRegistry.AtomRegistry, KeyContext>();

export function bindingOwner(scope: "session" | undefined, registry?: AtomRegistry.AtomRegistry): BindingOwner | undefined {
	if (scope === undefined) {
		return undefined;
	}
	if (registry === undefined) {
		throw new Error("A session-scoped contract requires its owning registry");
	}
	let context = contexts.get(registry);
	if (context === undefined) {
		context = { scope: crypto.randomUUID() };
		contexts.set(registry, context);
	}
	return { context, registry };
}
