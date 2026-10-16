import { builtinEnvironments, type Environment } from "vitest/runtime";

const domEnvironment: Environment = {
	name: "test-story-dom",
	async setup(global: typeof globalThis, options) {
		const { Headers, Request, Response } = global;
		const environment = await builtinEnvironments["happy-dom"].setup(global, options);
		// Vitest's setters also replace happy-dom's internal classes, which its fetch needs.
		for (const [name, value] of Object.entries({ Headers, Request, Response })) {
			Object.defineProperty(global, name, { configurable: true, value, writable: true });
		}
		const transport = global.fetch.bind(global);
		Object.defineProperty(global, "fetch", {
			configurable: true,
			value: (input: RequestInfo | URL, init?: RequestInit) => {
				if (input instanceof Request) {
					const request = new Request(input, init);
					return transport(request.url, {
						body: request.body,
						cache: request.cache,
						credentials: request.credentials,
						headers: [...request.headers],
						method: request.method,
						mode: request.mode,
						redirect: request.redirect,
						referrer: request.referrer,
						referrerPolicy: request.referrerPolicy,
						signal: request.signal,
					});
				}
				return transport(input, init?.headers instanceof Headers ? { ...init, headers: [...init.headers] } : init);
			},
			writable: true,
		});
		return environment;
	},
	viteEnvironment: "client",
};

export default domEnvironment;
