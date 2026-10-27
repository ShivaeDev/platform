import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

export function rootRoute() {
	return createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()<unknown>();
}
