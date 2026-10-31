import { RegistryContext } from "@effect/atom-react";
import type { Duration } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, type ReactNode, useEffect, useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { mountLive } from "#client/mountLive.ts";
import { liveBindings } from "#internal/liveBindings.ts";
import { RecheckContext } from "#internal/RecheckContext.ts";
import { registerSessionRecheck } from "#internal/sessionRecheck.ts";
import { useLatestCallback } from "#internal/useLatestCallback.ts";

interface Owned<TClient> {
	readonly client: TClient;
	mounted: number;
	readonly registry: AtomRegistry.AtomRegistry;
}
function owning<TClient>(connect: (registry: AtomRegistry.AtomRegistry) => TClient, identity: string | undefined): Owned<TClient> {
	const registry = AtomRegistry.make({ "defaultIdleTTL": 400 });
	let client: { readonly value: TClient } | undefined;
	return {
		get client() {
			client ??= { value: connect(registry) };
			for (const binding of liveBindings(client.value)) {
				const session = binding[LiveConnection].identity;
				if (session !== undefined) {
					registry.set(session, identity);
				}
			}
			return client.value;
		},
		mounted: 0,
		registry,
	};
}
// No cleanup runs when a hidden <Activity> subtree is unmounted, so nodes a hidden render creates must not outlive it.
function hidden<TClient>(connect: (registry: AtomRegistry.AtomRegistry) => TClient, identity: string | undefined): Owned<TClient> {
	const owned = owning(connect, identity);
	let reaping = false;
	owned.registry.onNodeAdded = () => {
		if (reaping || owned.mounted > 0) {
			return;
		}
		reaping = true;
		setTimeout(() => {
			reaping = false;
			if (owned.mounted === 0) {
				owned.registry.reset();
			}
		}, 0);
	};
	return owned;
}
interface SessionGenerationProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly identity: string | undefined;
	readonly liveCoalesceWindow?: Duration.Input | undefined;
	readonly recheck: () => void;
	readonly session: TSession;
}
export function SessionGeneration<TSession, TClient>({
	session,
	connect,
	recheck,
	children,
	identity,
	liveCoalesceWindow,
}: SessionGenerationProps<TSession, TClient>): ReactNode {
	const recheckLatest = useLatestCallback(recheck);
	const [open] = useState(() => (registry: AtomRegistry.AtomRegistry) => connect(session, registry));
	const [owned, own] = useState(() => owning(open, identity));
	useEffect(() => registerSessionRecheck(owned.registry, recheckLatest), [owned, recheckLatest]);
	useEffect(() => {
		owned.mounted += 1;
		const stopLive = mountLive(owned.registry, owned.client, liveCoalesceWindow);
		return () => {
			stopLive();
			owned.mounted -= 1;
			queueMicrotask(() => {
				if (owned.mounted > 0) {
					return;
				}
				owned.registry.dispose();
				own((current) => (current === owned ? hidden(open, identity) : current));
			});
		};
	}, [identity, owned, liveCoalesceWindow, open]);
	return createElement(
		RecheckContext.Provider,
		{ value: recheckLatest },
		createElement(RegistryContext.Provider, { value: owned.registry }, children(owned.client)),
	);
}
