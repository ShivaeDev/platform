import { Window } from "happy-dom";
import { decodedBody } from "./decodedBody.ts";
import { rpcCall } from "./rpc.ts";
import type { ScreenEngine } from "./screenEngine.ts";

interface Session {
	readonly engine: ScreenEngine;
	// happy-dom checks a request's origin against its window only after awaiting, so each origin keeps its own window.
	readonly transports: Map<string, Window>;
}

const sessions = new Map<string, Session>();

export function transportWindow(url: string) {
	return new Window({
		settings: { fetch: { interceptor: { afterAsyncResponse: ({ response, window }) => decodedBody(response, window) } } },
		url,
	});
}

// Effect's fetch reference retains the first function it reads; keep its identity stable across sessions.
export async function sessionFetch(...args: Parameters<Window["fetch"]>) {
	const input = args[0];
	const url = requestUrl(input);
	const origin = new URL(url).origin;
	const current = sessions.get(origin) ?? sessions.values().next().value;
	if (!current) {
		throw new Error(`No active story session for ${origin}`);
	}
	const { engine, transports } = current;
	const transport = transportFor(transports, origin);
	if (engine.serverStopped) {
		throw new TypeError("Failed to fetch");
	}
	const boundary = engine.sessionTransport;
	if (boundary) {
		const call = await rpcCall(transport, ...args);
		if (call?.tag === boundary.tag) {
			boundary.commands.push(call);
			await boundary.gate;
			if (boundary.offline) {
				throw new Error("Connection lost while saving");
			}
		}
	}
	return transport.fetch(...args);
}

export function registerSessionFetch(origin: string, transport: Window, engine: ScreenEngine) {
	const transports = new Map([[origin, transport]]);
	sessions.set(origin, { engine, transports });
	return async () => {
		sessions.delete(origin);
		await Promise.all([...transports.values()].filter((window) => window !== transport).map((window) => window.happyDOM.abort()));
	};
}

function transportFor(transports: Map<string, Window>, origin: string) {
	const existing = transports.get(origin);
	if (existing) {
		return existing;
	}
	const created = transportWindow(origin);
	transports.set(origin, created);
	return created;
}

function requestUrl(input: Parameters<Window["fetch"]>[0]) {
	if (typeof input === "string") {
		return input;
	}
	return "url" in input ? input.url : input.href;
}
