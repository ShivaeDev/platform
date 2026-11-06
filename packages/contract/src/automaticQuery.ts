import { Cause, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { AutomaticQueryOptions } from "#AutomaticQueryOptions.ts";
import type { LiveStatus } from "#live.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { queryFailure } from "#queryFailure.ts";
import { recordCompletion, recordSubscription } from "#queryProgress.ts";
import { queryResult } from "#queryResult.ts";

interface GateOptions<A, E> extends AutomaticQueryOptions<A, E> {
	readonly assertOwner: (get: Atom.AtomContext) => void;
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
	resultVersion,
	signals,
	source,
	statuses,
	subscription,
	subscriptionVersion,
}: GateOptions<A, E>) {
	const gated = Atom.readable(
		(get) => {
			assertOwner(get);
			get.mount(signals);
			get.mount(resultVersion);
			get.mount(subscriptionVersion);
			const openingVersion = get.once(subscriptionVersion);
			get.refresh(subscription.connection);
			const registry = get.registry;
			const dispatcher = registry.schedulerAsync.makeDispatcher();
			let denied = false;
			let stopSource: (() => void) | undefined;
			get.addFinalizer(() => stopSource?.());
			get.set(ready, false);
			get.set(signals, { ...get.once(signals), pending: true, subscription: "opening" });
			get.once(queryCoalesceWindow(gated));
			get.subscribe(queryCoalesceWindow(gated), (value) => get.set(queryCoalesceWindow(source), value), { immediate: true });
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
				if (value.connection === "live" && get.once(subscriptionVersion) > openingVersion) {
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
			let deniedVersion = 0;
			function start() {
				if (stopSource !== undefined) {
					return;
				}
				if (!pushed && get.once(resultVersion) === deniedVersion) {
					get.refresh(source);
				}
				started = true;
				const publish = queryResult<A, E>(equivalent, (value) => {
					if (!denied) {
						get.setSelf(value);
						get.set(signals, recordCompletion(get.once(signals), value));
					}
				});
				stopSource = registry.subscribe(source, publish, { immediate: true });
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
						deniedVersion = get.once(resultVersion);
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
