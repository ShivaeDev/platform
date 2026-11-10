import { Cause, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { AutomaticQueryOptions } from "#AutomaticQueryOptions.ts";
import type { LiveStatus } from "#live.ts";
import { recordCompletion, recordSubscription } from "#queryProgress.ts";
import { queryResult } from "#queryResult.ts";

type GateOptions<A, E> = AutomaticQueryOptions<A, E> & { readonly ownerFailure: (get: Atom.AtomContext) => Error | undefined };
export function automaticQuery<A, E>({
	clientStatuses,
	equivalent,
	ownerFailure,
	paused,
	ready,
	signals,
	source,
	statuses,
	subscription,
	subscriptionVersion,
}: GateOptions<A, E>) {
	const gated = Atom.readable(
		(get) => {
			get.mount(signals);
			const error = ownerFailure(get);
			if (error !== undefined) {
				const failure = AsyncResult.failure(Cause.die(error));
				get.set(signals, recordCompletion(get.once(signals), failure));
				return failure;
			}
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
			function start() {
				if (stopSource !== undefined) {
					return;
				}
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
				} else {
					const previous = get.self<AsyncResult.AsyncResult<A, E>>();
					if (Option.isSome(previous)) {
						const waiting = AsyncResult.waiting(previous.value);
						get.setSelf(waiting);
						get.set(signals, recordCompletion(get.once(signals), waiting));
					}
				}
			});
			get.subscribe(subscription.status, ({ connection: state, failure }) => {
				if (state !== "failed" || Option.isNone(failure)) {
					return;
				}
				const cause = failure.value;
				if (Option.exists(Cause.findErrorOption(cause), Predicate.isTagged("QueryReadDenied"))) {
					denied = true;
					registry.set(ready, false);
					stopSource?.();
					stopSource = undefined;
				}
				const result = AsyncResult.failure(cause);
				get.setSelf(result);
				get.set(signals, recordCompletion(get.once(signals), result));
			});
			get.addFinalizer(registry.subscribe(paused, (value) => registry.set(subscription.paused, value), { immediate: true }));
			function resume() {
				if (get.once(subscription.status).connection !== "failed") {
					get.refresh(subscription.connection);
				}
			}
			get.subscribe(paused, (value) => {
				if (!value) {
					resume();
				}
			});
			get.mount(subscription.connection);
			if (get.once(ready)) {
				start();
				return get.once(source);
			}
			return AsyncResult.initial(true);
		},
		(refresh) => {
			refresh(ready);
			refresh(subscription.connection);
		},
	).pipe(Atom.setIdleTTL(0));
	return gated;
}
