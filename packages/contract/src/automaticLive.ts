import { type Duration, Effect, type Schema, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import { aggregateLiveStatus } from "#internal/aggregateLiveStatus.ts";
import { automaticQuery } from "#internal/automaticQuery.ts";
import type { BindingOwner } from "#internal/bindingOwner.ts";
import { queryDelivery } from "#internal/queryDelivery.ts";
import { localQueryKeys, queryHint } from "#internal/queryHints.ts";
import type { QueryUpdate } from "#internal/queryUpdate.ts";
import { socketIdentity } from "#internal/rpcClient.ts";
import { type LiveStatus, live } from "#live.ts";
import { type ResumeSource, type ResumeWindow, resumeSignal } from "#resume.ts";
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
		decode?: (value: unknown) => A,
	) {
		if (!enabled) {
			return atom;
		}
		const ready = Atom.make(false);
		const delivery = queryDelivery(atom, decode, paused);
		const source = delivery.atom;
		const subscription = live(service.runtime, {
			initialResync: false,
			keyContext: owner?.context,
			resume: signal,
			resyncKeys: decode === undefined ? localQueryKeys(keys) : [],
			stream: Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { queries: [reference] })))).pipe(
				delivery.stream,
				Stream.map((hint) => queryHint(hint, [{ keys }])),
			),
		});
		const gated = automaticQuery({
			assertOwner,
			atom,
			coalesceWindow,
			equivalent,
			paused,
			pushed: decode !== undefined,
			ready,
			signal,
			source,
			statuses,
			subscription,
		});
		Object.assign(gated, { initialValueTarget: atom });
		if (Atom.isSerializable(atom)) {
			Object.assign(gated, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
		}
		return gated;
	}
	return { query, subscription: { coalesceWindow, connection, identity: socketIdentity, paused, status } };
}
