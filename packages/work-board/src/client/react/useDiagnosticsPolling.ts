import { RegistryContext } from "@effect/atom-react";
import { Duration, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect } from "react";
import type { BrowserClient } from "#adapters/browserClient.ts";
import { clockEffect } from "#client/react/adapters/clockEffect.ts";
import { useBoardClock } from "#client/react/FormContext.ts";

export function useDiagnosticsPolling<A, TFleet>(
	client: (Pick<BrowserClient, "registry"> & { readonly updates: Pick<BrowserClient["updates"], "paused"> }) | undefined,
	atom: Atom.Atom<A>,
	fleet?: Atom.Atom<TFleet>,
) {
	const registry = useContext(RegistryContext);
	const clock = useBoardClock();
	useEffect(() => {
		function refresh() {
			if (!(document.hidden || client?.registry.get(client.updates.paused))) {
				registry.refresh(atom);
				if (fleet) {
					registry.refresh(fleet);
				}
			}
		}
		const stop = clockEffect(Effect.forever(clock.sleep(Duration.millis(15_000)).pipe(Effect.andThen(Effect.sync(refresh)))));
		const resumed = client?.registry.subscribe(client.updates.paused, (paused) => {
			if (!paused) {
				refresh();
			}
		});
		document.addEventListener("visibilitychange", refresh);
		return () => {
			stop();
			resumed?.();
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [atom, fleet, registry, client, clock]);
}
