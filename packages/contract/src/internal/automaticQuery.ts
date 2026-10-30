import type { Duration } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { LiveBound, LiveConnection } from "#automaticLive.ts";
import { queryFailure } from "#internal/queryFailure.ts";
import { queryResult } from "#internal/queryResult.ts";
import type { LiveStatus } from "#live.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";

interface GateOptions<A, E> {
	readonly assertOwner: (get: Atom.AtomContext) => void;
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly coalesceWindow: Atom.Writable<Duration.Input>;
	readonly equivalent: (left: A, right: A) => boolean;
	readonly paused: Atom.Writable<boolean>;
	readonly pushed: boolean;
	readonly ready: Atom.Writable<boolean>;
	readonly signal: Atom.Atom<unknown>;
	readonly source: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly statuses: Atom.Writable<ReadonlyMap<object, LiveStatus<unknown>>>;
	readonly subscription: LiveBound[typeof LiveConnection];
}
export function automaticQuery<A, E>({
	atom,
	assertOwner,
	coalesceWindow,
	equivalent,
	paused,
	pushed,
	ready,
	signal,
	source,
	statuses,
	subscription,
}: GateOptions<A, E>) {
	const gated = Atom.readable(
		(get) => {
			assertOwner(get);
			const registry = get.registry;
			const dispatcher = registry.schedulerAsync.makeDispatcher();
			get.set(ready, false);
			get.once(queryCoalesceWindow(gated));
			get.subscribe(queryCoalesceWindow(gated), (value) => get.set(queryCoalesceWindow(atom), value), { immediate: true });
			const token = {};
			let active = true;
			function observe(value: LiveStatus<unknown>) {
				dispatcher.scheduleTask(() => {
					if (active) {
						registry.update(statuses, (current) => new Map([...current, [token, value]]));
					}
				}, 0);
				if (value.connection === "live") {
					registry.set(ready, true);
				}
			}
			get.addFinalizer(() => {
				active = false;
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
				if (!pushed) {
					get.refresh(source);
				}
				const publish = queryResult<A, E>(equivalent, (value) => get.setSelf(value));
				get.subscribe(source, publish);
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
				(cause) => get.setSelf(AsyncResult.failure(cause)),
				() => get.refresh(source),
			);
			get.subscribe(subscription.status, failed);
			get.addFinalizer(registry.subscribe(paused, (value) => registry.set(subscription.paused, value), { immediate: true }));
			if (pushed) {
				get.once(signal);
				get.subscribe(signal, () => get.refresh(subscription.connection));
				get.subscribe(paused, (value) => {
					if (!value) {
						get.refresh(subscription.connection);
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
		(refresh) => (pushed ? refresh(subscription.connection) : refresh(atom)),
	).pipe(Atom.setIdleTTL(0));
	return gated;
}
