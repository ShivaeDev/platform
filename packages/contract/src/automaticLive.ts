import { Cause, Effect, Option, type Schema, Stream } from "effect";
import type { Headers } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { BindingOwner } from "#adapters/bindingOwner.ts";
import { aggregateLiveStatus } from "#aggregateLiveStatus.ts";
import { automaticQuery } from "#automaticQuery.ts";
import { clientActivities } from "#clientActivities.ts";
import { type LiveStatus, live } from "#live.ts";
import { queryDelivery } from "#queryDelivery.ts";
import { queryProgress } from "#queryProgress.ts";
import { querySignals, shareQuerySignals } from "#querySignals.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
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

export type ChangesClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<
		`${string}.$changes`,
		Schema.Struct<{ queries: Schema.$Array<Schema.Struct<{ query: Schema.String; payload: Schema.Unknown }>> }>,
		RpcSchema.Stream<Schema.Schema<QueryUpdate>, Schema.Unknown>,
		Schema.Never
	>
>;

export function automaticLive(
	service: ChangesClient,
	name: string,
	owner?: BindingOwner,
	resume?: ResumeSource,
	enabled = true,
	resumeWindow?: ResumeWindow,
) {
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
		keys: readonly Key[],
		equivalent: (left: A, right: A) => boolean,
		decode: (value: unknown) => A,
		reactive: (source: Atom.Atom<AsyncResult.AsyncResult<A, E>>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
		headers?: Headers.Input,
	) {
		if (!enabled) {
			return queryProgress(reactive(atom));
		}
		const ready = Atom.make(false);
		const signals = querySignals(atom);
		const delivery = queryDelivery(decode, paused, signals);
		const source = delivery.atom;
		const subscription = live(service.runtime, {
			keyContext: owner?.context,
			resume: signal,
			retryKeys: keys,
			stream: Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { queries: [reference] }, { headers })))).pipe(
				delivery.stream,
			),
		});
		const gated = automaticQuery({
			clientStatuses: clientActivities.get(service)?.statuses,
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
