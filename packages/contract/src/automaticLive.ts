import { type Duration, Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { BindingOwner } from "#internal/bindingOwner.ts";
import { localQueryKeys, queryHint } from "#internal/queryHints.ts";
import { queryResult } from "#internal/queryResult.ts";
import { type LiveStatus, live } from "#live.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { type ResumeSource, type ResumeWindow, resumeSignal } from "#resume.ts";
import type { changesRpc, QueryReference } from "#serverMetadata.ts";

declare const window: ResumeWindow | undefined;

export const LiveConnection = Symbol.for("@shivaedev/contract/LiveConnection");
export interface LiveBound {
	readonly [LiveConnection]: {
		readonly coalesceWindow: Atom.Writable<Duration.Input>;
		readonly connection: Atom.Atom<unknown>;
		readonly status: Atom.Atom<LiveStatus<unknown>>;
	};
}

export type ChangesClient = AtomRpc.AtomRpcClient<unknown, string, ReturnType<typeof changesRpc>>;

export function automaticLive(service: ChangesClient, name: string, owner?: BindingOwner, resume?: ResumeSource, enabled = true) {
	function assertOwner(get: Atom.AtomContext) {
		if (owner !== undefined && owner.registry !== get.registry) {
			throw new Error("A session-scoped query belongs to its binding registry");
		}
	}
	const coalesceWindow = Atom.keepAlive(Atom.make<Duration.Input>("20 millis"));
	const statuses = Atom.make<ReadonlyMap<object, LiveStatus<unknown>>>(new Map());
	const status = Atom.map(statuses, (current): LiveStatus<unknown> => {
		const values = [...current.values()];
		let connection: LiveStatus<unknown>["connection"] = "live";
		if (values.some((value) => value.connection === "connecting")) {
			connection = "connecting";
		}
		if (values.some((value) => value.connection === "reconnecting")) {
			connection = "reconnecting";
		}
		return {
			connection,
			failure: values.find((value) => Option.isSome(value.failure))?.failure ?? Option.none(),
			needsResync: values.some((value) => value.needsResync),
			pending: values.reduce((sum, value) => sum + value.pending, 0),
		};
	});
	const signal = resumeSignal({ ...(typeof window === "undefined" ? {} : { window }), ...(resume === undefined ? {} : { native: resume }) });
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
	) {
		if (!enabled) {
			return atom;
		}
		const ready = Atom.make(false);
		const subscription = live(service.runtime, {
			initialResync: false,
			keyContext: owner?.context,
			resume: signal,
			resyncKeys: localQueryKeys(keys),
			stream: Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { queries: [reference] })))).pipe(
				Stream.map((hint) => queryHint(hint, [{ keys }])),
			),
		});
		const gated = Atom.readable(
			(get) => {
				assertOwner(get);
				const registry = get.registry;
				get.set(ready, false);
				get.once(queryCoalesceWindow(gated));
				get.subscribe(queryCoalesceWindow(gated), (value) => get.set(queryCoalesceWindow(atom), value), { immediate: true });
				const token = {};
				function observe(value: LiveStatus<unknown>) {
					registry.update(statuses, (current) => new Map([...current, [token, value]]));
					if (value.connection === "live") {
						registry.set(ready, true);
					}
				}
				get.addFinalizer(() => {
					if (registry.getNodes().has(statuses)) {
						registry.update(statuses, (current) => {
							const next = new Map(current);
							next.delete(token);
							return next;
						});
					}
				});
				get.addFinalizer(registry.subscribe(subscription.status, observe, { immediate: true }));
				get.addFinalizer(registry.subscribe(coalesceWindow, (value) => registry.set(subscription.coalesceWindow, value), { immediate: true }));
				let started = false;
				function start() {
					if (started) {
						return;
					}
					started = true;
					get.refresh(atom);
					const publish = queryResult<A, E>(equivalent, (value) => get.setSelf(value));
					get.subscribe(atom, publish);
					publish(get.once(atom));
				}
				get.once(ready);
				get.subscribe(ready, (value) => {
					if (value) {
						start();
					}
				});
				get.subscribe(subscription.status, (value) => {
					if (!started && Option.isSome(value.failure)) {
						get.setSelf(AsyncResult.failure(value.failure.value));
					}
				});
				get.mount(subscription.connection);
				if (get.once(ready)) {
					start();
					return get.once(atom);
				}
				return AsyncResult.initial();
			},
			(refresh) => refresh(atom),
		).pipe(Atom.setIdleTTL(0));
		Object.assign(gated, { initialValueTarget: atom });
		if (Atom.isSerializable(atom)) {
			Object.assign(gated, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
		}
		return gated;
	}
	return { query, subscription: { coalesceWindow, connection, status } };
}
