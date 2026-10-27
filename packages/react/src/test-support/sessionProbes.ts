import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, useContext, useState } from "react";

export interface RegistryHolder {
	registry?: AtomRegistry.AtomRegistry;
}

export function ReplayProbe({ count, held }: { readonly count: Atom.Atom<AsyncResult.AsyncResult<number>>; readonly held: RegistryHolder }) {
	held.registry = useContext(RegistryContext);
	const value = useAtomValue(count);
	return createElement("output", null, value._tag === "Success" ? value.value + 1 : "…");
}

export function DraftProbe({
	count,
	registries,
}: {
	readonly count: Atom.Atom<AsyncResult.AsyncResult<number>>;
	readonly registries: AtomRegistry.AtomRegistry[];
}) {
	const registry = useContext(RegistryContext);
	if (!registries.includes(registry)) {
		registries.push(registry);
	}
	const [draft] = useState(() => `draft-${registries.length}`);
	const value = useAtomValue(count);
	return createElement("output", null, `${draft}:${value._tag === "Success" ? value.value + 1 : "…"}`);
}

export function TrackedProbe({ round, held, rendered }: { readonly round: number; readonly held: Atom.Atom<number>; readonly rendered: number[] }) {
	rendered.push(round);
	return createElement("output", null, `${round}:${useAtomValue(held)}`);
}

export function RegistryProbe({ registries }: { readonly registries: AtomRegistry.AtomRegistry[] }) {
	const registry = useContext(RegistryContext);
	if (!registries.includes(registry)) {
		registries.push(registry);
	}
	return null;
}
