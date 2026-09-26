import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createContext, createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";

export interface SessionBoundaryProps<S, Client> {
	readonly session: S | undefined;
	readonly identify: (session: S) => string;
	readonly connect: (session: S) => Client;
	readonly recheck: () => void;
	readonly signedOut?: ReactNode;
	readonly children: (client: Client) => ReactNode;
}

const Recheck = createContext<() => void>(() => {});

export const useSessionRecheck = (): (() => void) => useContext(Recheck);

interface Owned<Client> {
	readonly client: Client;
	readonly registry: AtomRegistry.AtomRegistry;
	mounted: number;
}

const owning = <Client>(client: Client): Owned<Client> => ({ client, registry: AtomRegistry.make(), mounted: 0 });

// No cleanup runs when a hidden <Activity> subtree is unmounted, so nodes a hidden render creates must not outlive it.
const hidden = <Client>(client: Client): Owned<Client> => {
	const owned = owning(client);
	let reaping = false;
	owned.registry.onNodeAdded = () => {
		if (reaping || owned.mounted > 0) return;
		reaping = true;
		setTimeout(() => {
			reaping = false;
			if (owned.mounted === 0) owned.registry.reset();
		}, 0);
	};
	return owned;
};

interface GenerationProps<S, Client> {
	readonly session: S;
	readonly connect: (session: S) => Client;
	readonly recheck: () => void;
	readonly children: (client: Client) => ReactNode;
}

const Generation = <S, Client>({ session, connect, recheck, children }: GenerationProps<S, Client>): ReactNode => {
	const [owned, own] = useState(() => owning(connect(session)));
	useEffect(() => {
		owned.mounted += 1;
		return () => {
			owned.mounted -= 1;
			queueMicrotask(() => {
				if (owned.mounted > 0) return;
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

export const SessionBoundary = <S, Client>({
	session,
	identify,
	connect,
	recheck,
	signedOut,
	children,
}: SessionBoundaryProps<S, Client>): ReactNode =>
	session === undefined
		? createElement(Fragment, null, signedOut)
		: createElement(Generation<S, Client>, { key: identify(session), session, connect, recheck, children });
