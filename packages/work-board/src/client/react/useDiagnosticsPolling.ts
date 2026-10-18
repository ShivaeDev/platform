import { RegistryContext } from "@effect/atom-react";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect } from "react";
import type { BrowserClient } from "#client/client.ts";

export function useDiagnosticsPolling<A, TFleet>(
	client: (Pick<BrowserClient, "registry"> & { readonly updates: Pick<BrowserClient["updates"], "paused"> }) | undefined,
	atom: Atom.Atom<A>,
	fleet?: Atom.Atom<TFleet>,
) {
	const registry = useContext(RegistryContext);
	useEffect(() => {
		function refresh() {
			if (!(document.hidden || client?.registry.get(client.updates.paused))) {
				registry.refresh(atom);
				if (fleet) {
					registry.refresh(fleet);
				}
			}
		}
		const timer = setInterval(refresh, 15_000);
		const resumed = client?.registry.subscribe(client.updates.paused, (paused) => {
			if (!paused) {
				refresh();
			}
		});
		document.addEventListener("visibilitychange", refresh);
		return () => {
			clearInterval(timer);
			resumed?.();
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [atom, fleet, registry, client]);
}
