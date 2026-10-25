import { type Duration, Effect, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { BindingOwner } from "#internal/bindingOwner.ts";
import { type Key, readKeys } from "#keys.ts";
import { type LiveStatus, live } from "#live.ts";
import { type ResumeSource, type ResumeWindow, resumeSignal } from "#resume.ts";
import type { changesRpc, QueryReference } from "#serverMetadata.ts";

declare const window: ResumeWindow | undefined;

export const LiveConnection = Symbol.for("@shivaedev/effect-contract/LiveConnection");
export interface LiveBound {
	readonly [LiveConnection]: {
		readonly coalesceWindow: Atom.Writable<Duration.Input>;
		readonly connection: Atom.Atom<unknown>;
		readonly status: Atom.Atom<LiveStatus<unknown>>;
	};
}

export type ChangesClient = AtomRpc.AtomRpcClient<unknown, string, ReturnType<typeof changesRpc>>;

interface Tracked {
	readonly keys: readonly Key[];
	readonly reference: QueryReference;
}

export function automaticLive(service: ChangesClient, name: string, owner?: BindingOwner, resume?: ResumeSource) {
	const eager = owner === undefined ? Effect.runSync(SubscriptionRef.make<ReadonlyMap<object, Tracked>>(new Map())) : undefined;
	const known = new Set<string>();
	const tracked = Atom.keepAlive(Atom.make(() => eager ?? Effect.runSync(SubscriptionRef.make<ReadonlyMap<object, Tracked>>(new Map()))));
	function track(registry: AtomRegistry.AtomRegistry | undefined, reference: QueryReference, keys: readonly Key[]) {
		const fresh =
			eager === undefined
				? keys
				: keys.filter((key) => {
						const id = readKeys([key])[0] ?? "";
						if (known.has(id)) {
							return false;
						}
						known.add(id);
						return true;
					});
		if (fresh.length === 0) {
			return () => undefined;
		}
		const token = {};
		const state = eager ?? registry?.get(tracked);
		if (state === undefined) {
			throw new Error("Session query tracking requires its owning registry");
		}
		Effect.runSync(SubscriptionRef.update(state, (current) => new Map([...current, [token, { keys: fresh, reference }]])));
		if (eager !== undefined) {
			return () => undefined;
		}
		return () =>
			Effect.runSync(
				SubscriptionRef.update(state, (current) => {
					const next = new Map(current);
					next.delete(token);
					return next;
				}),
			);
	}
	function subscribe(current: ReadonlyMap<object, Tracked>) {
		if (current.size === 0) {
			return Stream.never;
		}
		const queries = [...current.values()].map(({ reference }) => reference);
		return Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { queries }))));
	}
	const signal = resumeSignal({ ...(typeof window === "undefined" ? {} : { window }), ...(resume === undefined ? {} : { native: resume }) });
	const subscription = live(service.runtime, {
		keyContext: owner?.context,
		resume: signal,
		resyncKeys: (registry) => [...Effect.runSync(SubscriptionRef.get(registry.get(tracked))).values()].flatMap(({ keys }) => keys),
		stream: Stream.unwrap(
			Effect.map(AtomRegistry.AtomRegistry, (registry) =>
				Stream.zipLatest(SubscriptionRef.changes(registry.get(tracked)), AtomRegistry.toStream(registry, signal)).pipe(
					Stream.switchMap(([current]) => subscribe(current)),
				),
			),
		),
	});
	const connection = Atom.make((get) => {
		if (owner !== undefined && owner.registry !== get.registry) {
			throw new Error("A session-scoped live connection belongs to its binding registry");
		}
		return get(subscription.connection);
	}).pipe(Atom.setIdleTTL(0));
	return { subscription: { ...subscription, connection }, track };
}
