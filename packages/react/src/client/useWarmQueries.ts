import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useEffect, useMemo } from "react";
import { warmQueries } from "@shivaedev/contract/warmQueries.ts";

function warmMounts(registry: AtomRegistry.AtomRegistry) {
	const mounted = new Map<Atom.Atom<unknown>, () => void>();
	return {
		follow(queries: readonly Atom.Atom<unknown>[]) {
			const listed = new Set(queries);
			if (listed.size !== mounted.size || queries.some((query) => !mounted.has(query))) {
				registry.set(warmQueries, listed);
			}
			for (const query of listed) {
				if (!mounted.has(query)) {
					mounted.set(query, registry.mount(query));
				}
			}
			for (const [query, unmount] of mounted) {
				if (!listed.has(query)) {
					mounted.delete(query);
					unmount();
				}
			}
		},
		release() {
			for (const unmount of mounted.values()) {
				unmount();
			}
			mounted.clear();
		},
	};
}

export function useWarmQueries(registry: AtomRegistry.AtomRegistry, queries: readonly Atom.Atom<unknown>[]) {
	const warm = useMemo(() => warmMounts(registry), [registry]);
	useEffect(() => () => warm.release(), [warm]);
	useEffect(() => warm.follow(queries), [warm, queries]);
}
