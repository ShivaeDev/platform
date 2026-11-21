import { RegistryContext } from "@effect/atom-react";
import type { Effect, Layer } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, type ReactNode, useContext } from "react";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import type { QueryRetentionOptions } from "@shivaedev/contract/queryRetention.ts";
import { DraftSessionContext } from "@shivaedev/form/react.ts";
import { SessionGeneration } from "#client/adapters/SessionGeneration.ts";
import { SessionHandoff } from "#client/adapters/SessionHandoff.ts";
import { useDeviceWipe, useStoredQueryWipes } from "#client/adapters/useStoredQueries.ts";
import { RecheckContext } from "#client/RecheckContext.ts";
import { SessionSignOut } from "#client/SessionSignOut.ts";
import { SignOutRegistryContext } from "#client/SignOutRegistryContext.ts";
import { useDraftOwner } from "#client/useDraftOwner.ts";
import { useSessionRetry } from "#client/useSessionRetry.ts";
export interface SessionBoundaryProps<TSession, TClient> {
	readonly children: (client: TClient) => ReactNode;
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly identify: (session: TSession) => string;
	readonly navigate?: ((href: string) => void) | undefined;
	readonly persist?: Layer.Layer<QueryStorageProvider> | undefined;
	readonly queryRetention?: QueryRetentionOptions | undefined;
	readonly recheck: (() => void) | Effect.Effect<unknown, unknown, AtomRegistry.AtomRegistry>;
	readonly redirectTo?: string | undefined;
	readonly runtime?: Pick<Atom.AtomRuntime<never, unknown>, "fn"> | undefined;
	readonly session: TSession | undefined;
	readonly signedOut?: ReactNode;
	readonly signOut?: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>> | undefined;
	readonly warm?: ((client: TClient) => readonly Atom.Atom<unknown>[]) | undefined;
}
// Signed out, a recheck still runs, so a sign-in screen can ask for the session it just created.
const SIGNED_OUT = "signed out";
export function useSessionRecheck(): () => void {
	return useContext(RecheckContext);
}
export function SessionBoundary<TSession, TClient>({
	session,
	runtime,
	queryRetention,
	identify,
	connect,
	recheck,
	signedOut,
	signOut,
	redirectTo,
	navigate,
	persist,
	warm,
	children,
}: SessionBoundaryProps<TSession, TClient>): ReactNode {
	const registry = useContext(RegistryContext);
	const id = session === undefined ? undefined : identify(session);
	const current = useDraftOwner(id);
	const retry = useSessionRetry(recheck, id ?? SIGNED_OUT, runtime);
	useStoredQueryWipes(persist, id);
	const wipe = useDeviceWipe(persist);
	if (session === undefined) {
		return createElement(RecheckContext.Provider, { value: retry }, signedOut);
	}
	const generation = createElement(SessionGeneration<TSession, TClient>, {
		children,
		connect,
		identity: id,
		persist,
		queryRetention,
		recheck: retry,
		session,
		warm,
	});
	return createElement(
		SignOutRegistryContext.Provider,
		{ value: registry },
		createElement(
			DraftSessionContext.Provider,
			{ value: current },
			createElement(
				SessionHandoff,
				{ key: id, navigate, redirectTo },
				signOut === undefined ? generation : createElement(SessionSignOut, { action: signOut, recheck: retry, wipe }, generation),
			),
		),
	);
}
