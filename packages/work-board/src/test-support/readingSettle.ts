import { Deferred, Effect, PubSub } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { laterReads } from "./laterReads.ts";
import { pendingSignal } from "./pendingSignal.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenPendingWork } from "./screenSettle.ts";

const SETTLE_LIMIT_MS = 10_000;

const pendingFrames = new WeakMap<ScreenEngine, Set<number>>();

export function followFrames(engine: ScreenEngine) {
	const pending = new Set<number>();
	const request = window.requestAnimationFrame.bind(window);
	const cancel = window.cancelAnimationFrame.bind(window);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const id = request((time) => {
			pending.delete(id);
			callback(time);
		});
		pending.add(id);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => {
		pending.delete(id);
		cancel(id);
	});
	pendingFrames.set(engine, pending);
}

function gateStarts(engine: ScreenEngine, read: { readonly gate: Deferred.Deferred<void>; started: boolean }) {
	return Effect.suspend(() => {
		read.started = true;
		return PubSub.publish(engine.transportEvents, undefined).pipe(Effect.andThen(Deferred.await(read.gate)));
	});
}

// A held later read counts as pending until it starts; once it waits on its gate nothing behind it can finish, so it stops holding settle.
export const holdLaterRead = Effect.fn("ReadingSettle.holdLaterRead")(function* (engine: ScreenEngine, url: string) {
	const read = { gate: yield* Deferred.make<void>(), started: false, url };
	laterReads.set(engine, read);
	const options = engine.options;
	engine.options = {
		...options,
		beforeRead: (kind, requested) =>
			(options?.beforeRead?.(kind, requested) ?? Effect.void).pipe(Effect.andThen(requested === url ? gateStarts(engine, read) : Effect.void)),
	};
	yield* Effect.addFinalizer(() =>
		Effect.promise(() =>
			act(() => {
				releaseLaterRead(engine);
				return Promise.resolve();
			}),
		),
	);
});

export function releaseLaterRead(engine: ScreenEngine) {
	const read = laterReads.get(engine);
	if (!read) {
		throw new Error("The story holds no later document read");
	}
	Effect.runSync(Deferred.succeed(read.gate, undefined));
}

function open(gate: Deferred.Deferred<void> | undefined) {
	return gate !== undefined && !Effect.runSync(Deferred.isDone(gate));
}

function held(engine: ScreenEngine) {
	return (
		engine.chunkResponse?.held === true
		|| [engine.heldRead?.gate, engine.heldRefresh?.gate, engine.heldAnswerRefresh?.gate, engine.indexGate, engine.startupGate].some(open)
	);
}

function routeRendered(engine: ScreenEngine) {
	const location = engine.router?.state.location;
	const doc = document.getElementById("doc");
	if (!(location && doc) || held(engine)) {
		return true;
	}
	const route = location.pathname + location.searchStr;
	return doc.dataset.route === route || (laterReadWaits(engine) && laterReads.get(engine)?.url === route);
}

function laterReadWaits(engine: ScreenEngine) {
	const read = laterReads.get(engine);
	return read?.started === true && open(read.gate);
}

function framesPending(engine: ScreenEngine) {
	return (pendingFrames.get(engine)?.size ?? 0) > 0;
}

// Screen settle sees neither a body rendered section by section nor animation frames, so a reading page also waits for #doc to mark its route.
export const readingSettles = Effect.fn("ReadingSettle.readingSettles")(function* (
	engine: ScreenEngine,
	tell: (line: string) => void = (line) => engine.tell?.(line),
) {
	const screen = yield* screenPendingWork(engine);
	function pending() {
		return (!laterReadWaits(engine) && screen()) || !routeRendered(engine) || framesPending(engine);
	}
	yield* screenDriver({ act: screenAct, pending: pendingSignal(engine, pending), root: () => document.body, tell }).settle({
		timeoutMs: SETTLE_LIMIT_MS,
	});
});

export const framesSettle = Effect.fn("ReadingSettle.framesSettle")(function* (
	engine: ScreenEngine,
	tell: (line: string) => void = (line) => engine.tell?.(line),
) {
	const screen = yield* screenPendingWork(engine);
	yield* screenDriver({
		act: screenAct,
		pending: pendingSignal(engine, () => screen() || framesPending(engine)),
		root: () => document.body,
		tell,
	}).settle({
		timeoutMs: SETTLE_LIMIT_MS,
	});
});
