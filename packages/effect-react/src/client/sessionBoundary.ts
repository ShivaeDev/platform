import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createContext, createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";
import { DraftSessionContext } from "@shivaedev/effect-form/client/react.ts";
import { registerSessionRecheck } from "#internal/sessionRecheck.ts";
import { useDraftOwner } from "./useDraftOwner.ts";
export interface SessionBoundaryProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession) => TClient;
	readonly identify: (session: TSession) => string;
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
function owning<TClient>(client: TClient): Owned<TClient> {
	return { client, mounted: 0, registry: AtomRegistry.make({ "defaultIdleTTL": 400 }) };
}
// No cleanup runs when a hidden <Activity> subtree is unmounted, so nodes a hidden render creates must not outlive it.
function hidden<TClient>(client: TClient): Owned<TClient> {
	const owned = owning(client);
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
	readonly connect: (session: TSession) => TClient;
	readonly recheck: () => void;
	readonly session: TSession;
}
function Generation<TSession, TClient>({ session, connect, recheck, children }: GenerationProps<TSession, TClient>): ReactNode {
	const [owned, own] = useState(() => owning(connect(session)));
	useEffect(() => registerSessionRecheck(owned.registry, recheck), [owned, recheck]);
	useEffect(() => {
		owned.mounted += 1;
		return () => {
			owned.mounted -= 1;
			queueMicrotask(() => {
				if (owned.mounted > 0) {
					return;
				}
				owned.registry.dispose();
				own((current) => (current === owned ? hidden(owned.client) : current));
			});
		};
	}, [owned]);
	return createElement(
		RecheckContext.Provider,
		{ value: recheck },
		createElement(RegistryContext.Provider, { value: owned.registry }, children(owned.client)),
	);
}
export function SessionBoundary<TSession, TClient>({
	session,
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
				createElement(Generation<TSession, TClient>, { children, connect, key: id, recheck, session }),
			);
}
