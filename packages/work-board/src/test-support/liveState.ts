import type { Deferred, Effect, Fiber, Tracer } from "effect";
import type { AgentConnection } from "./liveAgent.ts";
import type { ChangeSubscription } from "./liveChanges.ts";
import type { BoardEngine } from "./storyEngine.ts";
import type { Tally } from "./Tally.ts";

export interface FailingWatcher {
	readonly attempts: number[];
	broken: boolean;
	fail: () => void;
	readonly restarts: Tally;
}

export interface DirectoryReports {
	readonly changed: (path: string) => Effect.Effect<unknown>;
	readonly watchedPaths: () => readonly string[];
}

export interface OwnedBoard {
	readonly finish: () => void;
	readonly owner: Fiber.Fiber<void, unknown>;
}

export interface StartupReads {
	readonly distinct: Tally;
	readonly files: Set<string>;
	readonly gate?: Deferred.Deferred<void>;
}

export interface CrashingStorage {
	crash: boolean;
	readonly original: Error;
	readonly spans: Tracer.NativeSpan[];
}

export interface LiveState {
	agent?: AgentConnection;
	crashing?: CrashingStorage;
	directories?: DirectoryReports;
	owned?: OwnedBoard;
	staging?: { path: string };
	startupReads?: StartupReads;
	readonly subscriptions: Map<string, ChangeSubscription>;
	watcher?: FailingWatcher;
}

export const LIVE_CLIENT = "the live client";

const states = new WeakMap<BoardEngine, LiveState>();

export function liveState(engine: BoardEngine): LiveState {
	let state = states.get(engine);
	if (!state) {
		state = { subscriptions: new Map() };
		states.set(engine, state);
	}
	return state;
}

export function present<TValue>(value: TValue | undefined, missing: string): TValue {
	if (value === undefined) {
		throw new Error(missing);
	}
	return value;
}
