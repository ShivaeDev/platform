import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext } from "react";

export function SessionRegistry({ onRegistry }: { readonly onRegistry: (registry: AtomRegistry.AtomRegistry) => void }) {
	onRegistry(useContext(RegistryContext));
	return null;
}
