import { Effect } from "effect";
import type { McpClient } from "effect/ai";
import { type HostOptions, startHost } from "./startHost.ts";

type Host = Effect.Success<ReturnType<typeof startHost>>;

interface Person {
	readonly cookie: string;
	readonly id: string;
}

interface Story {
	readonly clientIds: Map<string, string>;
	readonly clients: Map<string, McpClient.McpClient>;
	readonly flows: Map<string, { readonly clientId: string; readonly offline: boolean; code?: string; consentQuery?: string }>;
	readonly grantIds: Map<string, string>;
	readonly people: Map<string, Person>;
	readonly refreshTokens: Map<string, string>;
	refusal: { readonly challenge: string | undefined; readonly status: number } | undefined;
	readonly tokens: Map<string, string>;
}

export function startEngine(options: HostOptions = {}) {
	return Effect.map(startHost(options), (host): Host & Story => ({
		...host,
		clientIds: new Map(),
		clients: new Map(),
		flows: new Map(),
		grantIds: new Map(),
		people: new Map(),
		refreshTokens: new Map(),
		refusal: undefined,
		tokens: new Map(),
	}));
}
export type Engine = Effect.Success<ReturnType<typeof startEngine>>;

export function person(engine: Engine, name: string) {
	const found = engine.people.get(name);
	if (found === undefined) {
		throw new Error(`${name} is not signed in`);
	}
	return found;
}

export function named(engine: Engine, text: string) {
	let replaced = text;
	for (const [name, { id }] of engine.people) {
		replaced = replaced.replaceAll(id, name);
	}
	return replaced;
}

export function path(engine: Engine, url: string) {
	return url.startsWith(engine.baseUrl) ? url.slice(engine.baseUrl.length) : url;
}
