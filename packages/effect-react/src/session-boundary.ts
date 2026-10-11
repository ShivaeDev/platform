import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createContext, createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";

export interface SessionBoundaryProps<S, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: S) => TClient;
	readonly identify: (session: S) => string;
	readonly recheck: () => void;
	readonly session: S | undefined;
	readonly signedOut?: ReactNode;
}

const Recheck = createContext<() => void>((): void => undefined);

export const useSessionRecheck = (): (() => void) => useContext(Recheck);

interface Owned<TClient> {
	readonly client: TClient;
	mounted: number;
	readonly registry: AtomRegistry.AtomRegistry;
}

function owning<TClient>(client: TClient): Owned<TClient> {
	return { client, mounted: 0, registry: AtomRegistry.make() };
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

interface GenerationProps<S, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: S) => TClient;
	readonly recheck: () => void;
	readonly session: S;
}

const Generation = <S, TClient>({ session, connect, recheck, children }: GenerationProps<S, TClient>): ReactNode => {
	const [owned, own] = useState(() => owning(connect(session)));
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
		Recheck.Provider,
		{ value: recheck },
		createElement(RegistryContext.Provider, { value: owned.registry }, children(owned.client)),
	);
};

export const SessionBoundary = <S, TClient>({
	session,
	identify,
	connect,
	recheck,
	signedOut,
	children,
}: SessionBoundaryProps<S, TClient>): ReactNode =>
	session === undefined
		? createElement(Fragment, null, signedOut)
		: createElement(Generation<S, TClient>, { children, connect, key: identify(session), recheck, session });
