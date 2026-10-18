import { isIP } from "node:net";
import { unrouted } from "#internal/errors.ts";

interface DispatchOptions {
	readonly origin: string | URL;
}

interface Dispatcher {
	readonly dispatch: (options: DispatchOptions, handler: unknown) => boolean;
}

function isDispatcher(value: unknown): value is Dispatcher {
	return typeof value === "object" && value !== null && "dispatch" in value && typeof value.dispatch === "function";
}

export async function installOutbound(routes: Readonly<Record<string, string>>, strict = false) {
	const origins = new Map(Object.entries(routes).map(([hostname, target]) => [hostname, new URL(target).origin]));
	let refused: Error | undefined;
	// A data URL initializes Node's bundled Undici without sending an HTTP request.
	await fetch("data:,");
	const slots = ["undici.globalDispatcher.1", "undici.globalDispatcher.2"].flatMap((name) => {
		const key = Symbol.for(name);
		const previous: unknown = Reflect.get(globalThis, key);
		return isDispatcher(previous) ? [{ key, previous }] : [];
	});
	if (slots.length === 0) {
		throw new Error("test-story outbound routing needs Node's built-in fetch dispatcher. Run the stories in Node.js 24 or newer.");
	}
	function restore() {
		for (const { key, previous } of slots) {
			Object.defineProperty(globalThis, key, { value: previous });
		}
	}
	try {
		for (const { key, previous } of slots) {
			const router: Dispatcher = {
				dispatch(options, handler) {
					const hostname = new URL(options.origin).hostname;
					const target = origins.get(hostname);
					if (
						strict
						&& target === undefined
						&& !["localhost", "[::1]"].includes(hostname)
						&& !(isIP(hostname) === 4 && hostname.startsWith("127."))
					) {
						refused = unrouted(hostname);
						throw refused;
					}
					return previous.dispatch(target === undefined ? options : { ...options, origin: target }, handler);
				},
			};
			Object.defineProperty(globalThis, key, { value: router });
		}
	} catch (error) {
		restore();
		throw error;
	}
	return () => {
		restore();
		if (refused !== undefined) {
			throw refused;
		}
	};
}
