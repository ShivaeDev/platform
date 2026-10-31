import { Context, Deferred, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { screenPending } from "@shivaedev/react/client/screenPending.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { session } from "#client/session.ts";
import type { ScreenEngine } from "./screenEngine.ts";

const SETTLE_LIMIT_MS = 10_000;

interface Hold {
	readonly held: boolean;
	readonly started: boolean;
}

function open(gate: Deferred.Deferred<void>) {
	return !Effect.runSync(Deferred.isDone(gate));
}

// A story that holds work on purpose has settled once that work waits on its gate; nothing behind it can finish before the release.
function holds(engine: ScreenEngine): readonly Hold[] {
	return [
		...(engine.heldRead ? [{ held: open(engine.heldRead.gate), started: engine.heldRead.started }] : []),
		...(engine.heldRefresh ? [{ held: open(engine.heldRefresh.gate), started: engine.heldRefresh.started }] : []),
		...(engine.heldAnswerRefresh ? [{ held: open(engine.heldAnswerRefresh.gate), started: engine.heldAnswerRefresh.started }] : []),
		...(engine.indexGate ? [{ held: open(engine.indexGate), started: engine.indexWaiting === true }] : []),
		...(engine.startupGate ? [{ held: open(engine.startupGate), started: true }] : []),
		...(engine.sessionTransport?.release ? [{ held: true, started: engine.sessionTransport.commandWaiting === true }] : []),
	].filter(({ held }) => held);
}

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

function sessionStarting(engine: ScreenEngine) {
	if (engine.session === undefined) {
		return false;
	}
	const { registry, updates } = session(engine.session.environment);
	return document.documentElement.dataset.boardReady !== "true" || registry.get(updates.status).connection === "connecting";
}

function registryOf(engine: ScreenEngine) {
	if (engine.session) {
		return withoutLiveStreams(session(engine.session.environment).registry);
	}
	return engine.view?.registry ?? engine.documentView?.registry;
}

export const screenPendingWork = Effect.fn("ScreenSettle.screenPendingWork")(function* (engine: ScreenEngine) {
	const registry = registryOf(engine);
	const pending =
		registry === undefined
			? () => false
			: yield* screenPending({ router: engine.router }).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry));
	return () => {
		const held = holds(engine);
		return held.length > 0 ? held.some(({ started }) => !started) : sessionStarting(engine) || pending();
	};
});

export const screenSettles = Effect.fn("ScreenSettle.screenSettles")(function* (
	engine: ScreenEngine,
	tell: (line: string) => void = (line) => engine.tell?.(line),
) {
	const pending = yield* screenPendingWork(engine);
	yield* screenDriver({ act: (action) => act(action), pending, root: () => document.body, tell }).settle({ timeoutMs: SETTLE_LIMIT_MS });
});

type Settled<TResult> = [TResult] extends [Effect.Effect<infer TSuccess, infer TError, infer TServices>]
	? Effect.Effect<TSuccess, TError, TServices>
	: Effect.Effect<Awaited<TResult>>;

type Settling<TVerbs> = {
	readonly [TKey in keyof TVerbs]: TVerbs[TKey] extends (...args: infer TArgs) => infer TResult ? (...args: TArgs) => Settled<TResult> : TVerbs[TKey];
};

function resultOf(verb: CallableFunction, args: unknown[]) {
	return Effect.suspend(() => {
		const result: unknown = Reflect.apply(verb, undefined, args);
		return Effect.isEffect(result) ? result : Effect.promise(async () => await result);
	});
}

function wrapped(engine: ScreenEngine, verbs: Record<string, unknown>, settles: (name: string) => boolean) {
	return Object.fromEntries(
		Object.entries(verbs).map(([name, verb]) => {
			if (typeof verb !== "function") {
				return [name, verb];
			}
			const callable: CallableFunction = verb;
			function run(...args: unknown[]) {
				return resultOf(callable, args);
			}
			return [name, settles(name) ? (...args: unknown[]) => Effect.tap(run(...args), () => screenSettles(engine)) : run];
		}),
	);
}

// Each verb returns its result as an Effect; settling verbs also wait for the screen to finish the work they started.
export function settlingVerbs<TVerbs extends Record<string, unknown>>(
	engine: ScreenEngine,
	verbs: TVerbs,
	unsettled?: ReadonlyArray<keyof TVerbs>,
): Settling<TVerbs>;
export function settlingVerbs(engine: ScreenEngine, verbs: Record<string, unknown>, unsettled: readonly PropertyKey[] = []) {
	return wrapped(engine, verbs, (name) => !unsettled.includes(name));
}

export function readoutVerbs<TVerbs extends Record<string, unknown>>(engine: ScreenEngine, verbs: TVerbs): Settling<TVerbs>;
export function readoutVerbs(engine: ScreenEngine, verbs: Record<string, unknown>) {
	return wrapped(engine, verbs, () => false);
}

export function settlingOnly<TVerbs extends Record<string, unknown>>(
	engine: ScreenEngine,
	verbs: TVerbs,
	settled: ReadonlyArray<keyof TVerbs>,
): Settling<TVerbs>;
export function settlingOnly(engine: ScreenEngine, verbs: Record<string, unknown>, settled: readonly PropertyKey[]) {
	return wrapped(engine, verbs, (name) => settled.includes(name));
}
