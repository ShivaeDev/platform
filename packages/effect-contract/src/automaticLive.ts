import { type Duration, Effect, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { BindingOwner } from "#internal/bindingOwner.ts";
import type { Key } from "#keys.ts";
import { type LiveStatus, live } from "#live.ts";
import { type ResumeWindow, resumeSignal } from "#resume.ts";
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

export function automaticLive(service: ChangesClient, name: string, owner?: BindingOwner) {
	const tracked = Atom.keepAlive(Atom.make(() => Effect.runSync(SubscriptionRef.make<ReadonlyMap<object, Tracked>>(new Map()))));
	function track(registry: AtomRegistry.AtomRegistry, reference: QueryReference, keys: readonly Key[]) {
		const token = {};
		const state = registry.get(tracked);
		Effect.runSync(SubscriptionRef.update(state, (current) => new Map([...current, [token, { keys, reference }]])));
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
	const subscription = live(service.runtime, {
		keyContext: owner?.context,
		resume: resumeSignal(typeof window === "undefined" ? {} : { window }),
		resyncKeys: (registry) => [...Effect.runSync(SubscriptionRef.get(registry.get(tracked))).values()].flatMap(({ keys }) => keys),
		stream: Stream.unwrap(
			Effect.map(AtomRegistry.AtomRegistry, (registry) => SubscriptionRef.changes(registry.get(tracked)).pipe(Stream.switchMap(subscribe))),
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
