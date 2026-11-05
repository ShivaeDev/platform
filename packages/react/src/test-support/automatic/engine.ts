import { Effect, Redacted } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { type WatchedClock, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { notifications } from "./notifications.ts";
import { openHost } from "./openHost.ts";
import { openScreen } from "./openScreen.tsx";
import { openWorker } from "./openWorker.ts";

export function busy(container: HTMLElement) {
	return container.querySelector('[data-pending="true"]') !== null || container.textContent?.includes("Loading") === true;
}

interface Narrator {
	tell: (line: string) => void;
}

type Host = Awaited<ReturnType<typeof openHost>>;

export interface Engine {
	readonly clock: WatchedClock;
	readonly delivered: Effect.Effect<readonly unknown[]>;
	readonly host: Host;
	readonly marked: Map<number, unknown>;
	readonly narrator: Narrator;
	readonly runtime: Atom.RuntimeFactory;
	readonly screen: Awaited<ReturnType<typeof openScreen>>;
	readonly secondHost: Host;
	readonly worker: Awaited<ReturnType<typeof openWorker>>;
}

export function* open() {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const clock = yield* watchedClock;
	const database = yield* PostgresTestDatabase;
	const delivered = yield* notifications;
	const host = yield* Effect.acquireRelease(
		Effect.promise(() => openHost(database.url)),
		(value) => Effect.promise(value.close),
	);
	const secondHost = yield* Effect.acquireRelease(
		Effect.promise(() => openHost(database.url)),
		(value) => Effect.promise(value.close),
	);
	const worker = yield* Effect.acquireRelease(
		Effect.promise(() => openWorker(Redacted.value(database.url))),
		(value) => Effect.promise(value.close),
	);
	const runtime = yield* storyRuntime;
	const screen = yield* Effect.acquireRelease(
		Effect.promise(() => openScreen(host.url, runtime)),
		(value) => Effect.promise(value.unmount),
	);
	const engine: Engine = { clock, delivered, host, marked: new Map(), narrator: { tell: () => undefined }, runtime, screen, secondHost, worker };
	return engine;
}

export function live(engine: Engine) {
	const { container } = engine.screen;
	return Effect.suspend(() =>
		settleScreen(container, () => container.querySelector('[data-live="live"]') === null || busy(container), engine.narrator.tell),
	);
}
