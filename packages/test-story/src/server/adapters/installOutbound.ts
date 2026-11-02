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

interface Registration {
	readonly origins: ReadonlyMap<string, string>;
	refused?: Error;
	readonly strict: boolean;
}

const registrations = new Set<Registration>();
let restoreDispatchers: (() => void) | undefined;

function routingFor(hostname: string) {
	let target: string | undefined;
	let strict: Registration | undefined;
	for (const registration of registrations) {
		target = registration.origins.get(hostname) ?? target;
		if (registration.strict) {
			strict = registration;
		}
	}
	return { strict, target };
}

function installDispatchers() {
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
					const { strict, target } = routingFor(hostname);
					if (
						strict !== undefined
						&& target === undefined
						&& !["localhost", "[::1]"].includes(hostname)
						&& !(isIP(hostname) === 4 && hostname.startsWith("127."))
					) {
						strict.refused = unrouted(hostname);
						throw strict.refused;
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
	return restore;
}

export async function installOutbound(routes: Readonly<Record<string, string>>, strict = true) {
	const registration: Registration = {
		origins: new Map(Object.entries(routes).map(([hostname, target]) => [hostname, new URL(target).origin])),
		strict,
	};
	// A data URL initializes Node's bundled Undici without sending an HTTP request.
	await fetch("data:,");
	if (restoreDispatchers === undefined) {
		restoreDispatchers = installDispatchers();
	}
	registrations.add(registration);
	return () => {
		registrations.delete(registration);
		if (registrations.size === 0) {
			restoreDispatchers?.();
			restoreDispatchers = undefined;
		}
		if (registration.refused !== undefined) {
			throw registration.refused;
		}
	};
}
