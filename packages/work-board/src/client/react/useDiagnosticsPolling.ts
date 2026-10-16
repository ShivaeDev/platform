import { RegistryContext } from "@effect/atom-react";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect } from "react";
import { session } from "#client/entry.ts";

export function useDiagnosticsPolling<A, TFleet>(atom: Atom.Atom<A>, fleet?: Atom.Atom<TFleet>) {
	const registry = useContext(RegistryContext);
	useEffect(() => {
		function refresh() {
			const native = session(window);
			if (!(document.hidden || native.registry.get(native.updates.paused))) {
				registry.refresh(atom);
				if (fleet) {
					registry.refresh(fleet);
				}
			}
		}
		const timer = setInterval(refresh, 15_000);
		document.addEventListener("board-updates-resumed", refresh);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			clearInterval(timer);
			document.removeEventListener("board-updates-resumed", refresh);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [atom, fleet, registry]);
}
