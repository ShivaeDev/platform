import { Effect } from "effect";
import type { PgBossClient } from "#client.ts";

type Listener = (error: Error) => void;

interface Observer {
	readonly dispose: () => void;
	readonly listeners: Set<Listener>;
}

const key = Symbol.for("@shivaedev/effect-pg-boss/error-observers");
const shared: unknown = Reflect.get(globalThis, key);
const observers: WeakMap<WeakKey, unknown> = shared instanceof WeakMap ? shared : new WeakMap<WeakKey, unknown>();
Reflect.set(globalThis, key, observers);

export function logClientError(error: Error): Effect.Effect<void> {
	const message = { event: "pg_boss_error", message: error.message };
	return Reflect.get(error, "code") === "57P01" ? Effect.logDebug(message) : Effect.logError(message);
}

export function observeClientErrors(client: PgBossClient, fallback: Listener): void {
	closeClientErrors(client);
	const listeners = new Set<Listener>();
	const listener: Listener = (error) => {
		if (listeners.size === 0) {
			fallback(error);
		} else {
			for (const report of listeners) {
				report(error);
			}
		}
	};
	// Pool shutdown can resolve before its clients finish disconnecting.
	client.on("error", listener);
	observers.set(client, { dispose: () => client.off("error", listener), listeners });
}

export function subscribeClientErrors(client: PgBossClient, listener: Listener): () => void {
	const observer = observerFor(client);
	if (observer === undefined) {
		throw new Error("pg-boss client has no error observer");
	}
	observer.listeners.add(listener);
	return () => observer.listeners.delete(listener);
}

function closeClientErrors(client: PgBossClient): void {
	observerFor(client)?.dispose();
	observers.delete(client);
}

function observerFor(client: PgBossClient): Observer | undefined {
	const value = observers.get(client);
	return isObserver(value) ? value : undefined;
}

function isObserver(value: unknown): value is Observer {
	return (
		typeof value === "object"
		&& value !== null
		&& typeof Reflect.get(value, "dispose") === "function"
		&& Reflect.get(value, "listeners") instanceof Set
	);
}
