import { RegistryContext } from "@effect/atom-react";
import { type Duration, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect } from "react";
import { queryCoalesceWindow } from "@shivaedev/contract/queryCoalesceWindow.ts";
import { registerLiveWindow } from "#internal/registerLiveWindow.ts";

export function useLiveWindow(atom: Atom.Atom<unknown>, window: Duration.Input | undefined): void {
	const registry = useContext(RegistryContext);
	useEffect(() => {
		if (window === undefined) {
			return;
		}
		return Effect.runSync(registerLiveWindow(queryCoalesceWindow(atom), window).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));
	}, [registry, atom, window]);
}
