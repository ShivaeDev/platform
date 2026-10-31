import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { screenPending } from "@shivaedev/react/client/screenPending.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { session } from "#client/session.ts";
import { laterReads } from "./laterReads.ts";
import { pendingSignal, registryOf } from "./pendingSignal.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";

const SETTLE_LIMIT_MS = 10_000;

interface Hold {
	readonly held: boolean;
	readonly started: boolean;
}

function open(gate: Deferred.Deferred<void>) {
	return !Effect.runSync(Deferred.isDone(gate));
}

function startedLaterRead(engine: ScreenEngine): readonly Hold[] {
	const read = laterReads.get(engine);
	return read?.started ? [{ held: open(read.gate), started: true }] : [];
}

// A story that holds work on purpose has settled once that work waits on its gate; nothing behind it can finish before the release.
function holds(engine: ScreenEngine): readonly Hold[] {
	return [
		...(engine.heldRead ? [{ held: open(engine.heldRead.gate), started: engine.heldRead.started }] : []),
		...(engine.heldRefresh ? [{ held: open(engine.heldRefresh.gate), started: engine.heldRefresh.started }] : []),
		...(engine.heldAnswerRefresh ? [{ held: open(engine.heldAnswerRefresh.gate), started: engine.heldAnswerRefresh.started }] : []),
		...(engine.indexGate ? [{ held: open(engine.indexGate), started: engine.indexWaiting === true }] : []),
		...(engine.startupGate ? [{ held: open(engine.startupGate), started: true }] : []),
		...startedLaterRead(engine),
		...(engine.sessionTransport?.release ? [{ held: true, started: engine.sessionTransport.commandWaiting === true }] : []),
	].filter(({ held }) => held);
}

function sessionStarting(engine: ScreenEngine) {
	if (engine.session === undefined) {
		return false;
	}
	const { registry, updates } = session(engine.session.environment);
	return document.documentElement.dataset.boardReady !== "true" || registry.get(updates.status).connection === "connecting";
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
	yield* screenDriver({ act: screenAct, pending: pendingSignal(engine, pending), root: () => document.body, tell }).settle({
		timeoutMs: SETTLE_LIMIT_MS,
	});
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
