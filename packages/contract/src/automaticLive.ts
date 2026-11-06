import { type Duration, Effect, type Schema, Stream } from "effect";
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
import { localQueryKeys, queryHint } from "#queryHints.ts";
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
		readonly coalesceWindow: Atom.Writable<Duration.Input>;
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
	function assertOwner(get: Atom.AtomContext) {
		if (owner !== undefined && owner.registry !== get.registry) {
			throw new Error("A session-scoped query belongs to its binding registry");
		}
	}
	const coalesceWindow = Atom.keepAlive(Atom.make<Duration.Input>("20 millis"));
	const paused = pausedByRuntime(service.runtime);
	const statuses = Atom.make<ReadonlyMap<object, LiveStatus<unknown>>>(new Map());
	const status = Atom.map(statuses, (current) => aggregateLiveStatus([...current.values()]));
	const target = resumeWindow ?? (typeof window === "undefined" ? undefined : window);
	const signal = resumeSignal({ ...(target === undefined ? {} : { window: target }), ...(resume === undefined ? {} : { native: resume }) });
	const connection = Atom.make((get) => {
		assertOwner(get);
		get.mount(service.runtime);
		return get(status);
	}).pipe(Atom.setIdleTTL(0));
	function query<A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
		reference: QueryReference,
		keys: readonly Key[],
		equivalent: (left: A, right: A) => boolean,
		decode: (value: unknown) => A,
		compared: boolean,
		reactive: (source: Atom.Atom<AsyncResult.AsyncResult<A, E>>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
		headers?: Headers.Input,
	) {
		if (!enabled) {
			return queryProgress(reactive(atom));
		}
		const ready = Atom.make(false);
		const signals = querySignals(atom);
		const delivery = queryDelivery(atom, decode, compared, paused, signals);
		const source = compared ? delivery.atom : reactive(delivery.atom.pipe(Atom.setIdleTTL(0)));
		const subscription = live(service.runtime, {
			initialResync: false,
			keyContext: owner?.context,
			reopenOnResume: compared,
			resume: signal,
			resyncKeys: compared ? [] : localQueryKeys(keys),
			retryKeys: keys,
			stream: Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { queries: [reference] }, { headers })))).pipe(
				delivery.stream,
				Stream.map((hint) => queryHint(hint, [{ keys }])),
			),
		});
		const gated = automaticQuery({
			assertOwner,
			atom,
			clientStatuses: clientActivities.get(service)?.statuses,
			coalesceWindow,
			equivalent,
			paused,
			pushed: compared,
			ready,
			resultVersion: delivery.version,
			signals,
			source,
			statuses,
			subscription,
		});
		shareQuerySignals(gated, atom);
		Object.assign(gated, { initialValueTarget: atom });
		if (Atom.isSerializable(atom)) {
			Object.assign(gated, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
		}
		return gated;
	}
	return { query, subscription: { coalesceWindow, connection, identity: socketIdentity, paused, status } };
}
