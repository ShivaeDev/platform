import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createContext, createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";

export interface SessionBoundaryProps<S, Client> {
	readonly children: (client: Client) => ReactNode;
	readonly connect: (session: S) => Client;
	readonly identify: (session: S) => string;
	readonly recheck: () => void;
	readonly session: S | undefined;
	readonly signedOut?: ReactNode;
}

const Recheck = createContext<() => void>((): void => undefined);

export const useSessionRecheck = (): (() => void) => useContext(Recheck);

interface Owned<Client> {
	readonly client: Client;
	mounted: number;
	readonly registry: AtomRegistry.AtomRegistry;
}

function owning<Client>(client: Client): Owned<Client> {
	return { client, mounted: 0, registry: AtomRegistry.make() };
}

// No cleanup runs when a hidden <Activity> subtree is unmounted, so nodes a hidden render creates must not outlive it.
function hidden<Client>(client: Client): Owned<Client> {
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

interface GenerationProps<S, Client> {
	readonly children: (client: Client) => ReactNode;
	readonly connect: (session: S) => Client;
	readonly recheck: () => void;
	readonly session: S;
}

const Generation = <S, Client>({ session, connect, recheck, children }: GenerationProps<S, Client>): ReactNode => {
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
		: createElement(Generation<S, Client>, { children, connect, key: identify(session), recheck, session });
