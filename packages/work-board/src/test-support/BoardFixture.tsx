import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { type ReactNode, useContext, useState } from "react";

export function BoardFixture({ create }: { readonly create: (registry: AtomRegistry.AtomRegistry) => ReactNode }) {
	const registry = useContext(RegistryContext);
	const [node] = useState(() => create(registry));
	return node;
}
