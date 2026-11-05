import { Cause, type Duration, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { LiveBound, LiveConnection } from "#automaticLive.ts";
import type { LiveStatus } from "#live.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { queryFailure } from "#queryFailure.ts";
import { recordCompletion, recordSubscription } from "#queryProgress.ts";
import { queryResult } from "#queryResult.ts";
import type { QuerySignals } from "#querySignals.ts";

interface GateOptions<A, E> {
	readonly assertOwner: (get: Atom.AtomContext) => void;
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly clientStatuses: Atom.Writable<ReadonlyMap<object, LiveStatus<unknown>>> | undefined;
	readonly coalesceWindow: Atom.Writable<Duration.Input>;
	readonly equivalent: (left: A, right: A) => boolean;
	readonly paused: Atom.Writable<boolean>;
	readonly pushed: boolean;
	readonly ready: Atom.Writable<boolean>;
	readonly signals: Atom.Writable<QuerySignals>;
	readonly source: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly statuses: Atom.Writable<ReadonlyMap<object, LiveStatus<unknown>>>;
	readonly subscription: LiveBound[typeof LiveConnection];
}
export function automaticQuery<A, E>({
	atom,
	assertOwner,
	coalesceWindow,
	clientStatuses,
	equivalent,
	paused,
	pushed,
	ready,
	signals,
	source,
	statuses,
	subscription,
}: GateOptions<A, E>) {
	const gated = Atom.readable(
		(get) => {
			assertOwner(get);
			get.mount(signals);
			const registry = get.registry;
			const dispatcher = registry.schedulerAsync.makeDispatcher();
			let denied = false;
			let stopSource: (() => void) | undefined;
			get.addFinalizer(() => stopSource?.());
			get.set(ready, false);
			get.set(signals, { ...get.once(signals), pending: true, subscription: "opening" });
			get.once(queryCoalesceWindow(gated));
			get.subscribe(queryCoalesceWindow(gated), (value) => get.set(queryCoalesceWindow(atom), value), { immediate: true });
			const token = {};
			let active = true;
			function observe(value: LiveStatus<unknown>) {
				get.set(signals, recordSubscription(get.once(signals), value));
				dispatcher.scheduleTask(() => {
					if (active) {
						for (const state of clientStatuses === undefined ? [statuses] : [statuses, clientStatuses]) {
							registry.update(state, (current) => new Map([...current, [token, value]]));
						}
					}
				}, 0);
				if (value.connection === "live") {
					denied = false;
					registry.set(ready, true);
				}
			}
			get.addFinalizer(() => {
				active = false;
				for (const state of clientStatuses === undefined ? [statuses] : [statuses, clientStatuses]) {
					if (registry.getNodes().has(state)) {
						registry.update(state, (current) => {
							const next = new Map(current);
							next.delete(token);
							return next;
						});
					}
				}
			});
			get.addFinalizer(registry.subscribe(subscription.status, observe, { immediate: true }));
			get.addFinalizer(registry.subscribe(coalesceWindow, (value) => registry.set(subscription.coalesceWindow, value), { immediate: true }));
			let started = false;
			function start() {
				if (stopSource !== undefined) {
					return;
				}
				started = true;
				if (!pushed) {
					get.refresh(source);
				}
				const publish = queryResult<A, E>(equivalent, (value) => {
					if (!denied) {
						get.setSelf(value);
						get.set(signals, recordCompletion(get.once(signals), value));
					}
				});
				stopSource = registry.subscribe(source, publish);
				publish(get.once(source));
			}
			get.once(ready);
			get.subscribe(ready, (value) => {
				if (value) {
					start();
				}
			});
			const failed = queryFailure(
				() => started && !pushed,
				(cause) => {
					if (Option.exists(Cause.findErrorOption(cause), Predicate.isTagged("QueryReadDenied"))) {
						denied = true;
						registry.set(ready, false);
						stopSource?.();
						stopSource = undefined;
					}
					const result = AsyncResult.failure(cause);
					get.setSelf(result);
					get.set(signals, recordCompletion(get.once(signals), result));
				},
			);
			get.subscribe(subscription.status, failed);
			get.addFinalizer(registry.subscribe(paused, (value) => registry.set(subscription.paused, value), { immediate: true }));
			function resume() {
				if (get.once(subscription.status).connection !== "failed") {
					get.refresh(subscription.connection);
				}
			}
			if (pushed) {
				get.subscribe(paused, (value) => {
					if (!value) {
						resume();
					}
				});
			}
			get.mount(subscription.connection);
			if (get.once(ready)) {
				start();
				return get.once(source);
			}
			return AsyncResult.initial();
		},
		(refresh) => {
			if (!pushed) {
				refresh(atom);
			}
			refresh(subscription.connection);
		},
	).pipe(Atom.setIdleTTL(0));
	return gated;
}
