import { Cause, Effect, Option, Stream } from "effect";
import type { Headers } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc } from "effect/rpc";
import type { BindingOwner } from "#adapters/bindingOwner.ts";
import { changesClient } from "#adapters/erasedClient.ts";
import { aggregateLiveStatus } from "#aggregateLiveStatus.ts";
import { automaticQuery } from "#automaticQuery.ts";
import type { ActivityTracker } from "#clientActivities.ts";
import { type LiveStatus, live } from "#live.ts";
import { queryDelivery } from "#queryDelivery.ts";
import { querySignals, shareQuerySignals } from "#querySignals.ts";
import { followReflection, type StreamAnchor } from "#reflectedStream.ts";
import { type ResumeSource, type ResumeWindow, resumeSignal } from "#resume.ts";
import { socketIdentity } from "#rpcClient.ts";
import type { QueryReference } from "#serverMetadata.ts";

declare const window: ResumeWindow | undefined;

export const LiveConnection = Symbol.for("@shivaedev/contract/LiveConnection");
export interface LiveBound {
	readonly [LiveConnection]: {
		readonly connection: Atom.Atom<unknown>;
		readonly identity?: Atom.Writable<string | undefined>;
		readonly paused: Atom.Writable<boolean>;
		readonly status: Atom.Atom<LiveStatus<unknown>>;
	};
}

const pausedByRuntime = Atom.family((_runtime: object) => Atom.keepAlive(Atom.make(false)));

export function automaticLive(
	operations: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	activity: ActivityTracker,
	name: string,
	owner?: BindingOwner,
	resume?: ResumeSource,
	resumeWindow?: ResumeWindow,
) {
	const service = changesClient(operations);
	function ownerFailure(get: Atom.AtomContext) {
		return owner !== undefined && owner.registry !== get.registry ? new Error("A session-scoped query belongs to its binding registry") : undefined;
	}
	const paused = pausedByRuntime(service.runtime);
	const statuses = Atom.make<ReadonlyMap<object, LiveStatus<unknown>>>(new Map());
	const status = Atom.map(statuses, (current) => aggregateLiveStatus([...current.values()]));
	const target = resumeWindow ?? (typeof window === "undefined" ? undefined : window);
	const signal = resumeSignal({ ...(target === undefined ? {} : { window: target }), ...(resume === undefined ? {} : { native: resume }) });
	const connection = Atom.make((get) => {
		const error = ownerFailure(get);
		if (error !== undefined) {
			return { connection: "failed", failure: Option.some(Cause.die(error)), needsResync: true, pending: 0 } as const;
		}
		get.mount(service.runtime);
		return get(status);
	}).pipe(Atom.setIdleTTL(0));
	function query<A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
		reference: QueryReference,
		equivalent: (left: A, right: A) => boolean,
		decode: (value: unknown) => A,
		headers?: Headers.Input,
	) {
		const ready = Atom.make(false);
		const signals = querySignals(atom);
		const delivery = queryDelivery(decode, paused, signals);
		const source = delivery.atom;
		const anchors = new WeakMap<object, StreamAnchor>();
		function anchor(registry: object) {
			const existing = anchors.get(registry);
			if (existing !== undefined) {
				return existing;
			}
			const made: StreamAnchor = { armedAt: undefined, mounted: false, reflection: undefined, supported: undefined };
			anchors.set(registry, made);
			return made;
		}
		const subscription = live(service.runtime, {
			resume: signal,
			stream: Stream.unwrap(
				service.use((client) =>
					Effect.flatMap(AtomRegistry.AtomRegistry, (registry) =>
						Effect.map(followReflection(client, anchor(registry)), (reflected) => {
							const opened = client(`${name}.$changes`, { queries: [reference] }, { headers: reflected.headers(headers) });
							return delivery.stream(reflected.lifetime(opened), reflected.follower);
						}),
					),
				),
			),
		});
		const gated = automaticQuery({
			anchor,
			clientStatuses: activity.statuses,
			equivalent,
			ownerFailure,
			paused,
			ready,
			signals,
			source,
			statuses,
			subscription,
			subscriptionVersion: delivery.updates,
		});
		const result = Object.assign(
			Object.create(Object.getPrototypeOf(gated)),
			gated,
			{ initialValueTarget: atom },
			Atom.isSerializable(atom) ? { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] } : {},
		);
		shareQuerySignals(result, atom);
		return result;
	}
	return { query, subscription: { connection, identity: socketIdentity, paused, status } };
}
