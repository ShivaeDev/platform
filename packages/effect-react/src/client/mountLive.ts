import { Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";

export function mountLive(registry: AtomRegistry.AtomRegistry, client: unknown) {
	const releases: Array<() => void> = [];
	const found = new Set<unknown>();
	function mount(value: unknown) {
		if (!Predicate.hasProperty(value, LiveConnection)) {
			return;
		}
		const live = value[LiveConnection];
		if (Predicate.hasProperty(live, "connection") && Atom.isAtom(live.connection) && !found.has(live.connection)) {
			found.add(live.connection);
			releases.push(registry.mount(live.connection));
		}
	}
	mount(client);
	if (typeof client === "object" && client !== null) {
		for (const value of Object.values(client)) {
			mount(value);
		}
	}
	return () => {
		for (const release of releases) {
			release();
		}
	};
}
