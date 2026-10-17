import { GlobalWindow } from "happy-dom";
import { type Environment, populateGlobal } from "vitest/runtime";
import { documentTransport } from "#internal/documentTransport.ts";
import { installOutbound } from "#internal/routeOutbound.ts";

const domEnvironment: Environment = {
	name: "test-story-dom",
	async setup(global: typeof globalThis, { happyDOM = {} }) {
		const native = Object.fromEntries(
			["fetch", "AbortController", "AbortSignal", "Headers", "Request", "Response"].map((name) => [name, Reflect.get(global, name)]),
		);
		const restoreOutbound = await installOutbound({}, true);
		const win = new GlobalWindow({
			...happyDOM,
			console: global.console,
			settings: { ...happyDOM.settings, disableErrorCapturing: true },
			url: happyDOM.url ?? "http://localhost:3000",
		});
		win.happyDOM.settings.fetch.interceptor = documentTransport(global.fetch);
		const { keys, originals } = populateGlobal(global, win, { bindFunctions: true });
		for (const [name, value] of Object.entries(native)) {
			Object.defineProperty(global, name, { configurable: true, value, writable: true });
		}
		Object.defineProperty(global, "window", { configurable: true, value: win, writable: true });
		Object.defineProperty(win.document, "defaultView", { configurable: true, get: () => win });
		Object.defineProperty(global, Symbol.for("test-story.dom"), { configurable: true, value: true });
		return {
			async teardown(target) {
				try {
					await win.happyDOM.abort();
					win.close();
				} finally {
					for (const key of keys) {
						Reflect.deleteProperty(target, key);
					}
					for (const [key, descriptor] of originals) {
						Object.defineProperty(target, key, descriptor);
					}
					Reflect.deleteProperty(target, Symbol.for("test-story.dom"));
					restoreOutbound();
				}
			},
		};
	},
	viteEnvironment: "client",
};

export default domEnvironment;
