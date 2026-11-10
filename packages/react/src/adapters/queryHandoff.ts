import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRuntime } from "@shivaedev/contract/retainQuery.ts";

// A route commits only after its slowest sibling loader and any pending minimum, so the window covers those; a cancelled navigation holds the query no longer.
export const HAND_OVER_WINDOW = "5 seconds";

const handoffs = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<unknown>, Set<Promise<void>>>>();

export function keepLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>, signal: AbortSignal) {
	let atoms = handoffs.get(registry);
	if (!atoms) {
		atoms = new WeakMap();
		handoffs.set(registry, atoms);
	}
	const readers = atoms.get(atom) ?? new Set<Promise<void>>();
	atoms.set(atom, readers);
	const unmount = registry.mount(atom);
	const ready = Promise.withResolvers<void>();
	let mounted = true;
	let stopWindow: (() => void) | undefined;
	function complete() {
		if (readers.delete(ready.promise)) {
			ready.resolve();
		}
	}
	function release() {
		complete();
		if (mounted) {
			mounted = false;
			stopWindow?.();
			signal.removeEventListener("abort", release);
			unmount();
		}
	}
	function handOver() {
		complete();
		const runtime = queryRuntime(atom);
		if (runtime === undefined || !mounted) {
			release();
			return;
		}
		const timer = Atom.make((get) => {
			const services = get(runtime);
			if (AsyncResult.isSuccess(services)) {
				get.addFinalizer(Effect.runCallbackWith(services.value)(Effect.sleep(HAND_OVER_WINDOW), { onExit: release }));
			}
		}).pipe(Atom.setIdleTTL(0));
		stopWindow = registry.mount(timer);
	}
	readers.add(ready.promise);
	signal.addEventListener("abort", release, { once: true });
	if (signal.aborted) {
		release();
	}
	return { handOver, release };
}

export function pendingLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>): Promise<void> | undefined {
	for (const ready of handoffs.get(registry)?.get(atom) ?? []) {
		return ready;
	}
	return undefined;
}
