import type { Window } from "happy-dom";
import { rpcCall } from "./rpc.ts";
import type { ScreenEngine } from "./screenEngine.ts";

const sessions = new Map<string, { readonly transport: Window; readonly engine: ScreenEngine }>();

// Effect's fetch reference retains the first function it reads; keep its identity stable across sessions.
export async function sessionFetch(...args: Parameters<Window["fetch"]>) {
	const input = args[0];
	const url = requestUrl(input);
	const origin = new URL(url).origin;
	const current = sessions.get(origin) ?? sessions.values().next().value;
	if (!current) {
		throw new Error(`No active story session for ${origin}`);
	}
	const { engine, transport } = current;
	transport.happyDOM.setURL(origin);
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
	sessions.set(origin, { engine, transport });
	return () => sessions.delete(origin);
}

function requestUrl(input: Parameters<Window["fetch"]>[0]) {
	if (typeof input === "string") {
		return input;
	}
	return "url" in input ? input.url : input.href;
}
