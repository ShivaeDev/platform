import { RegistryContext } from "@effect/atom-react";
import type { Duration } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, Fragment, type ReactNode, useContext } from "react";
import { DraftSessionContext } from "@shivaedev/form/client/react.ts";
import { SessionGeneration } from "#client/adapters/SessionGeneration.ts";
import { SessionHandoff } from "#client/adapters/SessionHandoff.ts";
import { RecheckContext } from "#internal/RecheckContext.ts";
import { SignOutRegistryContext } from "#internal/SignOutRegistryContext.ts";
import { useDraftOwner } from "./useDraftOwner.ts";
export interface SessionBoundaryProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly identify: (session: TSession) => string;
	readonly liveCoalesceWindow?: Duration.Input | undefined;
	readonly navigate?: ((href: string) => void) | undefined;
	readonly recheck: () => void;
	readonly redirectTo?: string | undefined;
	readonly session: TSession | undefined;
	readonly signedOut?: ReactNode;
}
export function useSessionRecheck(): () => void {
	return useContext(RecheckContext);
}
export function SessionBoundary<TSession, TClient>({
	session,
	liveCoalesceWindow,
	identify,
	connect,
	recheck,
	signedOut,
	redirectTo,
	navigate,
	children,
}: SessionBoundaryProps<TSession, TClient>): ReactNode {
	const registry = useContext(RegistryContext);
	const id = session === undefined ? undefined : identify(session);
	const current = useDraftOwner(id);
	return session === undefined
		? createElement(Fragment, null, signedOut)
		: createElement(
				SignOutRegistryContext.Provider,
				{ value: registry },
				createElement(
					DraftSessionContext.Provider,
					{ value: current },
					createElement(
						SessionHandoff,
						{ key: id, navigate, redirectTo },
						createElement(SessionGeneration<TSession, TClient>, { children, connect, identity: id, liveCoalesceWindow, recheck, session }),
					),
				),
			);
}
