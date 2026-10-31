import { Context, Effect, Option, Queue, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ClientActivity, ClientActivityState } from "@shivaedev/contract/clientActivity.ts";
import { session } from "#client/session.ts";
import type { ScreenEngine } from "./screenEngine.ts";

function runtimeNode(node: AtomRegistry.Node<unknown>) {
	return Option.exists(
		node.valueOption(),
		(value) => AsyncResult.isAsyncResult(value) && AsyncResult.isSuccess(value) && Context.isContext(value.value),
	);
}

function liveStream(node: AtomRegistry.Node<unknown>) {
	return (
		node.atom.idleTTL === 0
		&& Option.exists(node.valueOption(), (value) => AsyncResult.isAsyncResult(value) && AsyncResult.isInitial(value))
		&& [...node.parents].some(runtimeNode)
	);
}

function withoutLiveStreams(registry: AtomRegistry.AtomRegistry) {
	return new Proxy(registry, {
		get: (target, key) =>
			key === "getNodes" ? () => new Map([...target.getNodes()].filter(([, node]) => !liveStream(node))) : Reflect.get(target, key),
	});
}

export function registryOf(engine: ScreenEngine) {
	if (engine.session) {
		return withoutLiveStreams(session(engine.session.environment).registry);
	}
	return engine.view?.registry ?? engine.documentView?.registry;
}

function waiting(node: AtomRegistry.Node<unknown>) {
	return Option.exists(node.valueOption(), (value) => AsyncResult.isAsyncResult(value) && value.waiting);
}

function observed(node: AtomRegistry.Node<unknown>, visited: Set<AtomRegistry.Node<unknown>>): boolean {
	visited.add(node);
	return node.listeners.size > 0 || [...node.children].some((child) => !visited.has(child) && observed(child, visited));
}

const idle: ClientActivityState = { liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 };
const busy: ClientActivityState = { ...idle, refreshingAtoms: 1 };

// The driver rereads `current` on every turn only for client activity, and the stream wakes it when a read query finishes without changing the DOM.
export function pendingSignal(engine: ScreenEngine, sample: () => boolean): ClientActivity {
	const current = Effect.sync(() => (sample() ? busy : idle));
	return Object.assign(wakes(engine, sample), { current });
}

function wakes(engine: ScreenEngine, sample: () => boolean): Stream.Stream<ClientActivityState> {
	return Stream.suspend(() => {
		const registry = registryOf(engine);
		let offer: (() => void) | undefined;
		function wake() {
			offer?.();
		}
		let watched: readonly (() => void)[] = [];
		function unwatch() {
			for (const stop of watched) {
				stop();
			}
			watched = [];
		}
		function check() {
			unwatch();
			const pending = sample();
			watched = [...(registry?.getNodes().values() ?? [])]
				.filter((node) => waiting(node) && observed(node, new Set()))
				.map((node) => node.subscribe(wake));
			return pending ? busy : idle;
		}
		const signals = Stream.callback<void>((queue) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					offer = () => Queue.offerUnsafe(queue, undefined);
					const observer = new MutationObserver(wake);
					observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
					const routed = (["onLoad", "onResolved", "onRendered"] as const).map((event) => engine.router?.subscribe(event, wake));
					const live = engine.session ? session(engine.session.environment) : undefined;
					const connection = live?.registry.subscribe(live.updates.status, wake);
					wake();
					return () => {
						observer.disconnect();
						for (const stop of [...routed, connection]) {
							stop?.();
						}
					};
				}),
				(stop) =>
					Effect.sync(() => {
						stop();
						unwatch();
					}),
			),
		);
		return Stream.map(signals, check);
	});
}
