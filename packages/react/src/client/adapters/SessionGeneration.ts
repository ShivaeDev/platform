import { RegistryContext } from "@effect/atom-react";
import { Effect, type Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement, type ReactNode, useEffect, useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { liveBindings } from "@shivaedev/contract/composeBindings.ts";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import { type QueryRetentionOptions, queryRetention } from "@shivaedev/contract/queryRetention.ts";
import { registerSessionRecheck } from "#adapters/sessionRecheck.ts";
import { useLatestCallback } from "#adapters/useLatestCallback.ts";
import { useStoredQueries } from "#client/adapters/useStoredQueries.ts";
import { useWarmQueries } from "#client/adapters/useWarmQueries.ts";
import { mountLive } from "#client/mountLive.ts";
import { RecheckContext } from "#client/RecheckContext.ts";

interface Owned<TClient> {
	readonly client: TClient;
	mounted: number;
	readonly registry: AtomRegistry.AtomRegistry;
}
interface Connection<TSession, TClient> {
	readonly connect: (session: TSession, registry: AtomRegistry.AtomRegistry) => TClient;
	readonly session: TSession;
}
function owning<TSession, TClient>(
	connection: Connection<TSession, TClient>,
	identity: string | undefined,
	retention: QueryRetentionOptions | undefined,
): Owned<TClient> {
	const registry = AtomRegistry.make({ "defaultIdleTTL": 400 });
	registry.set(queryRetention, retention ?? {});
	const { connect, session: initialSession } = connection;
	let client: { readonly value: TClient } | undefined;
	return {
		get client() {
			client ??= { value: connect(initialSession, registry) };
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
function hidden<TSession, TClient>(
	connection: Connection<TSession, TClient>,
	identity: string | undefined,
	retention: QueryRetentionOptions | undefined,
): Owned<TClient> {
	const owned = owning(connection, identity, retention);
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
	readonly persist?: Layer.Layer<QueryStorageProvider> | undefined;
	readonly queryRetention?: QueryRetentionOptions | undefined;
	readonly recheck: () => void;
	readonly session: TSession;
	readonly warm?: ((client: TClient) => readonly Atom.Atom<unknown>[]) | undefined;
}
const NOTHING_WARM: readonly Atom.Atom<unknown>[] = [];
export function SessionGeneration<TSession, TClient>({
	session,
	connect,
	recheck,
	children,
	identity,
	persist,
	queryRetention: retention,
	warm,
}: SessionGenerationProps<TSession, TClient>): ReactNode {
	const recheckLatest = useLatestCallback(recheck);
	const [connection] = useState(() => ({ connect, session }));
	const [owned, own] = useState(() => owning(connection, identity, retention));
	useEffect(() => {
		owned.registry.set(queryRetention, retention ?? {});
	}, [owned, retention]);
	useEffect(() => registerSessionRecheck(owned.registry, recheckLatest), [owned, recheckLatest]);
	useEffect(() => {
		owned.mounted += 1;
		const stopLive = Effect.runSync(mountLive(owned.client).pipe(Effect.provideService(AtomRegistry.AtomRegistry, owned.registry)));
		return () => {
			stopLive();
			owned.mounted -= 1;
			queueMicrotask(() => {
				if (owned.mounted > 0) {
					return;
				}
				const configured = owned.registry.get(queryRetention);
				owned.registry.dispose();
				own((current) => (current === owned ? hidden(connection, identity, configured) : current));
			});
		};
	}, [identity, owned, connection]);
	const ready = useStoredQueries(owned.registry, persist, identity);
	useWarmQueries(owned.registry, (ready ? warm?.(owned.client) : undefined) ?? NOTHING_WARM);
	return createElement(
		RecheckContext.Provider,
		{ value: recheckLatest },
		createElement(RegistryContext.Provider, { value: owned.registry }, ready ? children(owned.client) : null),
	);
}
