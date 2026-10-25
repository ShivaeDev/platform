import { isDeepStrictEqual } from "node:util";
import type { ConstructorOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { PgBossClientOptionsError } from "#error.ts";

interface CachedClient {
	readonly client: Promise<PgBossClient>;
	readonly constructorOptions: ConstructorOptions;
	references: number;
}

const cacheSymbol = Symbol.for("@shivaedev/effect-pg-boss/server/client-cache");
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
		&& Reflect.get(value, "client") instanceof Promise
		&& typeof Reflect.get(value, "constructorOptions") === "object"
		&& typeof Reflect.get(value, "references") === "number"
	);
}

export async function acquireCachedClient(key: string | symbol, constructorOptions: ConstructorOptions, start: () => Promise<PgBossClient>) {
	const existing = entryFor(key);
	if (existing !== undefined) {
		const options = [...new Set([...Object.keys(existing.constructorOptions), ...Object.keys(constructorOptions)])]
			.filter((option) => !isDeepStrictEqual(Reflect.get(existing.constructorOptions, option), Reflect.get(constructorOptions, option)))
			.sort((first, second) => first.localeCompare(second));
		if (options.length > 0) {
			throw new PgBossClientOptionsError({ key, options });
		}
		existing.references += 1;
		try {
			return { client: await existing.client, reused: true };
		} catch (error) {
			existing.references -= 1;
			throw error;
		}
	}
	const settings = { ...constructorOptions };
	const entry: CachedClient = { client: start(), constructorOptions: settings, references: 1 };
	clients.set(key, entry);
	try {
		return { client: await entry.client, reused: false };
	} catch (error) {
		if (clients.get(key) === entry) {
			clients.delete(key);
		}
		throw error;
	}
}

export function releaseCachedClient(key: string | symbol): Promise<PgBossClient> | undefined {
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
