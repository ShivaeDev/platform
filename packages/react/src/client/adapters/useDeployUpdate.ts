import { RegistryContext, useAtomMount, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect } from "react";
import type { deployUpdate } from "#client/deployUpdate.ts";

export function useDeployUpdate<E>(update: ReturnType<typeof deployUpdate<E>>) {
	useAtomMount(update.controller);
	return { ...useAtomValue(update.state), activation: useAtomValue(update.activation), reload: update.reload };
}

export function useUpdateBlocker<E>(update: ReturnType<typeof deployUpdate<E>>, blocked: boolean): void {
	const registry = useContext(RegistryContext);
	useEffect(() => {
		if (blocked) {
			return Effect.runSync(update.block.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));
		}
		return undefined;
	}, [blocked, registry, update]);
}
