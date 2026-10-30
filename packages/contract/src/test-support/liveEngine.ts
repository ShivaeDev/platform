import { Duration, Effect, type Exit, type Fiber, Option, Ref, type Stream, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { LiveHint, LiveStatus } from "#live.ts";
import { type HandledHints, liveClient } from "#test/live/client.ts";
import type { liveServer, ReadHold, ServedRead } from "#test/live/server.ts";
import { failure, times } from "./answers.ts";
import { Note } from "./notes.ts";
import { settled, signal } from "./settle.ts";

export type LiveView = "note 1" | "note 2" | "the list" | "the saved note 1" | "the short-lived note 1";

const NOTE_IDS = { "note 1": 1, "note 2": 2, "the saved note 1": 1, "the short-lived note 1": 1 } as const;

// libuv starts a timer from the event loop's cached time, so it can fire a few milliseconds short of its delay measured from the hint.
const TIMER_SLACK_MILLIS = 5;

export type LiveServer = Awaited<ReturnType<typeof liveServer>>;

export interface LiveSubscription {
	readonly controller: AbortController;
	readonly fiber: Fiber.Fiber<Exit.Exit<void, unknown>>;
	readonly hints: LiveHint[];
	readonly opened: number;
}

export interface LiveEngine {
	client: ReturnType<typeof liveClient>;
	connected: boolean;
	readonly mounted: Map<LiveView, () => void>;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly server: LiveServer;
	subscription: LiveSubscription | undefined;
	readonly watched: LiveView[];
}

export function makeLiveEngine(server: LiveServer, registry: AtomRegistry.AtomRegistry): LiveEngine {
	return { client: liveClient(server.url), connected: false, mounted: new Map(), registry, server, subscription: undefined, watched: [] };
}

export function viewAtom(engine: LiveEngine, view: LiveView): Atom.Atom<AsyncResult.AsyncResult<Note | readonly Note[], unknown>> {
	switch (view) {
		case "the list":
			return engine.client.api.list.query(undefined);
		case "the saved note 1":
			return engine.client.api.get.query({ id: 1 }, { serializationKey: "note-one" });
		case "the short-lived note 1":
			return engine.client.api.get.query({ id: 1 }, { timeToLive: "1 second" });
		case "note 1":
		case "note 2":
			return engine.client.api.get.query({ id: NOTE_IDS[view] });
	}
}

function readLabel(view: LiveView) {
	return view === "the list" ? "list" : `get:${NOTE_IDS[view]}`;
}

function bodies(value: Note | readonly Note[]): string | readonly string[] {
	return value instanceof Note ? value.body : value.map((note) => note.body);
}

function shownNow(result: AsyncResult.AsyncResult<Note | readonly Note[], unknown>): string | readonly string[] {
	if (AsyncResult.isSuccess(result)) {
		const shown = bodies(result.value);
		if (!result.waiting) {
			return shown;
		}
		return typeof shown === "string" ? `${shown}, re-reading` : shown.map((body) => `${body}, re-reading`);
	}
	return AsyncResult.isFailure(result) ? failure(result.cause) : "still loading";
}

export function shownOf(engine: LiveEngine, view: LiveView) {
	return Effect.map(settled(engine.registry, viewAtom(engine, view)), shownNow);
}

export function shownWithoutReadingOf(engine: LiveEngine, view: LiveView) {
	return Effect.sync(() => shownNow(engine.registry.get(viewAtom(engine, view))));
}

function readsOf(served: readonly ServedRead[], view: LiveView) {
	return served.filter((read) => read.label === readLabel(view));
}

export function readsBegunOf(engine: LiveEngine, view: LiveView) {
	return Effect.map(SubscriptionRef.get(engine.server.served), (served) => `read ${times(readsOf(served, view).length)}`);
}

export function timesReadOf(engine: LiveEngine, view: LiveView) {
	return Effect.andThen(shownOf(engine, view), readsBegunOf(engine, view));
}

function total(counts: HandledHints) {
	return counts.Changed + counts.Resync;
}

export function hintsHandled(engine: LiveEngine) {
	return Effect.map(SubscriptionRef.get(engine.client.handled), total);
}

export function untilHandledBeyond(engine: LiveEngine, count: number) {
	return signal(SubscriptionRef.changes(engine.client.handled), (counts) => total(counts) > count);
}

export const untilChangeHandled = Effect.fnUntraced(function* (engine: LiveEngine, edit: Effect.Effect<void>) {
	const before = yield* SubscriptionRef.get(engine.client.handled);
	yield* edit;
	if (engine.connected) {
		yield* signal(SubscriptionRef.changes(engine.client.handled), (counts) => counts.Changed > before.Changed);
	}
});

const readAfterLastHint = Effect.fnUntraced(function* (engine: LiveEngine, view: LiveView) {
	const { at } = yield* SubscriptionRef.get(engine.client.handled);
	yield* signal(SubscriptionRef.changes(engine.server.served), (served) => readsOf(served, view).some((read) => read.at > at));
	const first = readsOf(yield* SubscriptionRef.get(engine.server.served), view).find((candidate) => candidate.at > at);
	return first === undefined ? Option.none() : Option.some(first.at - at);
});

export function untilReadAfterLastHint(engine: LiveEngine, views: readonly LiveView[]) {
	return Effect.forEach(views, (view) => readAfterLastHint(engine, view), { discard: true });
}

export function reReadDelayOf(engine: LiveEngine, view: LiveView) {
	return Effect.map(readAfterLastHint(engine, view), (delay) => {
		const window = Duration.toMillis(Duration.fromInputUnsafe(engine.registry.get(engine.client.coalesceWindow)));
		return Option.match(delay, {
			onNone: () => "never re-read",
			onSome: (millis) =>
				millis + TIMER_SLACK_MILLIS >= window
					? `once the ${window} ms window closed`
					: `after only ${Math.round(millis)} ms of the ${window} ms window`,
		});
	});
}

export const watch = Effect.fnUntraced(function* (engine: LiveEngine, views: readonly LiveView[]) {
	for (const view of views) {
		engine.mounted.set(view, engine.registry.mount(viewAtom(engine, view)));
		engine.watched.push(view);
	}
	for (const view of views) {
		yield* shownOf(engine, view);
	}
});

export const connect = Effect.fnUntraced(function* (engine: LiveEngine) {
	const before = yield* hintsHandled(engine);
	engine.registry.mount(engine.client.connection);
	engine.connected = true;
	yield* untilHandledBeyond(engine, before);
	yield* signal(SubscriptionRef.changes(engine.server.active), (count) => count > 0);
	for (const view of engine.watched) {
		yield* shownOf(engine, view);
	}
});

export const holdReReadOfNoteOne = Effect.fnUntraced(function* (engine: LiveEngine, hold: ReadHold) {
	yield* Ref.set(engine.server.holding, hold);
	yield* untilChangeHandled(
		engine,
		Effect.promise(() => engine.server.edit(1, "In flight")),
	);
	yield* signal(SubscriptionRef.changes(engine.server.held), (count) => count > 0);
});

export const dropWhileRefused = Effect.fnUntraced(function* (engine: LiveEngine) {
	yield* Ref.set(engine.server.streamUnavailable, true);
	yield* Effect.promise(engine.server.disconnect);
	yield* signal(AtomRegistry.toStream(engine.registry, engine.client.status), (status) => Option.isSome(status.failure));
});

export function reload(engine: LiveEngine) {
	const saved = Hydration.dehydrate(engine.registry);
	engine.registry.reset();
	Hydration.hydrate(engine.registry, saved);
}

export function statusOf(engine: LiveEngine) {
	const status: LiveStatus<unknown> = engine.registry.get(engine.client.status);
	return {
		connection: status.connection,
		failure: Option.match(status.failure, { onNone: () => "none", onSome: failure }),
		needsResync: status.needsResync,
		pending: status.pending,
	};
}

export function streamRunner(engine: LiveEngine) {
	return <A, E>(effect: Effect.Effect<A, E, Stream.Services<ReturnType<typeof engine.client.api.subscribe.run>>>, abort?: AbortSignal) =>
		Effect.acquireUseRelease(
			Effect.sync(() => engine.registry.mount(engine.client.Client.runtime)),
			() =>
				Effect.promise((scopeSignal) =>
					Effect.runPromiseExit(
						Effect.flatMap(AtomRegistry.getResult(engine.registry, engine.client.Client.runtime), (context) =>
							Effect.provideContext(effect, context),
						),
						{ signal: abort === undefined ? scopeSignal : AbortSignal.any([abort, scopeSignal]) },
					),
				),
			(release) => Effect.sync(release),
		);
}

type LiveClientService = Effect.Services<ReturnType<LiveEngine["client"]["api"]["get"]["run"]>>;

export function called<A, E>(engine: LiveEngine, effect: Effect.Effect<A, E, Reactivity.Reactivity | LiveClientService>) {
	return Effect.exit(AtomRegistry.getResult(engine.registry, engine.client.Client.runtime.atom(effect)));
}

export function liveSnapshot({ client, server }: LiveEngine) {
	return {
		active: Effect.runSync(SubscriptionRef.get(server.active)),
		connections: Effect.runSync(SubscriptionRef.get(server.connections)),
		handled: Effect.runSync(SubscriptionRef.get(client.handled)),
		held: Effect.runSync(SubscriptionRef.get(server.held)),
		served: Effect.runSync(SubscriptionRef.get(server.served)).map((read) => read.label),
		stored: [...Effect.runSync(Ref.get(server.stored)).values()],
	};
}
