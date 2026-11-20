import { Effect, Exit, type Layer, Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredQueries, openStoredQueries, queryPersistence } from "@shivaedev/contract/adapters/queryPersistence.ts";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import { type OpenedQueryStorage, storedQueries } from "@shivaedev/contract/storedQueries.ts";
import { forgetSession, SessionMemory } from "@shivaedev/identity/client/SessionMemory.ts";
import { pageHidden } from "#client/pageHidden.ts";

type Opened = { readonly storage: OpenedQueryStorage | undefined } | undefined;

// The first screen renders once the user's stored results seed retention, so a loader finds them as retained values.
export function useStoredQueries(
	registry: AtomRegistry.AtomRegistry,
	persist: Layer.Layer<QueryStorageProvider> | undefined,
	identity: string | undefined,
): boolean {
	const [opened, open] = useState<Opened>(() => (persist === undefined || identity === undefined ? { storage: undefined } : undefined));
	useEffect(() => {
		if (persist === undefined || identity === undefined) {
			return;
		}
		return Effect.runCallback(openStoredQueries(identity).pipe(Effect.provide(persist)), {
			onExit: (exit) => open({ storage: Exit.isSuccess(exit) ? exit.value : undefined }),
		});
	}, [persist, identity]);
	if (opened?.storage !== undefined && registry.get(storedQueries) !== opened.storage) {
		registry.set(storedQueries, opened.storage);
	}
	useEffect(
		() =>
			registry.subscribe(pageHidden, (hidden) => {
				if (hidden) {
					registry.get(queryPersistence)?.flush();
				}
			}),
		[registry],
	);
	return opened !== undefined;
}

export function useStoredQueryWipes(persist: Layer.Layer<QueryStorageProvider> | undefined, identity: string | undefined) {
	const previousRef = useRef(identity);
	useEffect(() => {
		const before = previousRef.current;
		previousRef.current = identity;
		if (persist === undefined || (identity !== undefined && (before === undefined || before === identity))) {
			return;
		}
		Effect.runFork(clearStoredQueries(identity === undefined ? undefined : before).pipe(Effect.provide(persist)));
	}, [persist, identity]);
}

// A storage Layer that also supplies the remembered session forgets it in the same wipe, so a sign-out through the boundary leaves neither behind.
const deviceWipe = Effect.gen(function* () {
	const memory = yield* Effect.serviceOption(SessionMemory);
	yield* Option.isSome(memory) ? forgetSession.pipe(Effect.provideService(SessionMemory, memory.value)) : clearStoredQueries();
});

export function useDeviceWipe(persist: Layer.Layer<QueryStorageProvider> | undefined): () => void {
	return useCallback(() => {
		if (persist !== undefined) {
			Effect.runFork(deviceWipe.pipe(Effect.provide(persist)));
		}
	}, [persist]);
}
