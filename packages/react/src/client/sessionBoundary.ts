import { RegistryContext } from "@effect/atom-react";
import type { Duration } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createContext, createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";
import { DraftSessionContext } from "@shivaedev/form/client/react.ts";
import { registerSessionRecheck } from "#internal/sessionRecheck.ts";
import { useLatestCallback } from "#internal/useLatestCallback.ts";
import { mountLive } from "./mountLive.ts";
import { useDraftOwner } from "./useDraftOwner.ts";
export interface SessionBoundaryProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly identify: (session: TSession) => string;
	readonly liveCoalesceWindow?: Duration.Input | undefined;
	readonly recheck: () => void;
	readonly session: TSession | undefined;
	readonly signedOut?: ReactNode;
}
const RecheckContext = createContext<() => void>((): void => undefined);
export function useSessionRecheck(): () => void {
	return useContext(RecheckContext);
}
interface Owned<TClient> {
	readonly client: TClient;
	mounted: number;
	readonly registry: AtomRegistry.AtomRegistry;
}
function owning<TClient>(connect: (registry: AtomRegistry.AtomRegistry) => TClient): Owned<TClient> {
	const registry = AtomRegistry.make({ "defaultIdleTTL": 400 });
	let client: { readonly value: TClient } | undefined;
	return {
		get client() {
			client ??= { value: connect(registry) };
			return client.value;
		},
		mounted: 0,
		registry,
	};
}
// No cleanup runs when a hidden <Activity> subtree is unmounted, so nodes a hidden render creates must not outlive it.
function hidden<TClient>(connect: (registry: AtomRegistry.AtomRegistry) => TClient): Owned<TClient> {
	const owned = owning(connect);
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
interface GenerationProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly liveCoalesceWindow?: Duration.Input | undefined;
	readonly recheck: () => void;
	readonly session: TSession;
}
function Generation<TSession, TClient>({ session, connect, recheck, children, liveCoalesceWindow }: GenerationProps<TSession, TClient>): ReactNode {
	const recheckLatest = useLatestCallback(recheck);
	const [open] = useState(() => (registry: AtomRegistry.AtomRegistry) => connect(session, registry));
	const [owned, own] = useState(() => owning(open));
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
				own((current) => (current === owned ? hidden(open) : current));
			});
		};
	}, [owned, liveCoalesceWindow, open]);
	return createElement(
		RecheckContext.Provider,
		{ value: recheckLatest },
		createElement(RegistryContext.Provider, { value: owned.registry }, children(owned.client)),
	);
}
export function SessionBoundary<TSession, TClient>({
	session,
	liveCoalesceWindow,
	identify,
	connect,
	recheck,
	signedOut,
	children,
}: SessionBoundaryProps<TSession, TClient>): ReactNode {
	const id = session === undefined ? undefined : identify(session);
	const current = useDraftOwner(id);
	return session === undefined
		? createElement(Fragment, null, signedOut)
		: createElement(
				DraftSessionContext.Provider,
				{ value: current },
				createElement(Generation<TSession, TClient>, { children, connect, key: id, liveCoalesceWindow, recheck, session }),
			);
}
