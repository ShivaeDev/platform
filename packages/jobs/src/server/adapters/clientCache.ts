import { isDeepStrictEqual } from "node:util";
import type { ClientOptions } from "#server/clientOptions.ts";
import { PgBossClientOptionsError } from "#server/error.ts";
import type { StartingClient } from "./lifecycle.ts";

interface CachedClient {
	readonly client: StartingClient;
	readonly constructorOptions: ClientOptions;
	references: number;
}

const cacheSymbol = Symbol.for("@shivaedev/jobs/server/client-cache");
const shared: unknown = Reflect.get(globalThis, cacheSymbol);
const clients: Map<string | symbol, unknown> = shared instanceof Map ? shared : new Map<string | symbol, unknown>();
Reflect.set(globalThis, cacheSymbol, clients);

function entryFor(key: string | symbol): CachedClient | undefined {
	const value = clients.get(key);
	return isCachedClient(value) ? value : undefined;
}

function isCachedClient(value: unknown): value is CachedClient {
	return (
		typeof value === "object"
		&& value !== null
		&& typeof Reflect.get(value, "client") === "object"
		&& typeof Reflect.get(value, "constructorOptions") === "object"
		&& typeof Reflect.get(value, "references") === "number"
	);
}

export function acquireCachedClient(key: string | symbol, constructorOptions: ClientOptions, start: () => StartingClient) {
	const existing = entryFor(key);
	if (existing !== undefined) {
		const options = [...new Set([...Object.keys(existing.constructorOptions), ...Object.keys(constructorOptions)])]
			.filter((option) => !isDeepStrictEqual(Reflect.get(existing.constructorOptions, option), Reflect.get(constructorOptions, option)))
			.sort((first, second) => first.localeCompare(second));
		if (options.length > 0) {
			throw new PgBossClientOptionsError({ key, options });
		}
		existing.references += 1;
		return { ...existing.client, reused: true };
	}
	const settings = { ...constructorOptions };
	const entry: CachedClient = { client: start(), constructorOptions: settings, references: 1 };
	clients.set(key, entry);
	return { ...entry.client, reused: false };
}

export function releaseCachedClient(key: string | symbol): StartingClient | undefined {
	const entry = entryFor(key);
	if (entry === undefined) {
		return;
	}
	entry.references -= 1;
	if (entry.references > 0) {
		return;
	}
	clients.delete(key);
	return entry.client;
}
