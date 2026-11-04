import { Effect } from "effect";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appViteConfig } from "#appViteConfig.ts";

interface Engine {
	config: ReturnType<typeof appViteConfig> | undefined;
	env: { "PORT"?: string; "VITE_PORT"?: string };
}

export const viteConfig = storyKit({
	create: () => Effect.sync((): Engine => ({ config: undefined, env: {} })),
	name: "application development ports",
	stages: ["environment"],
	verbs: (engine, story) => ({
		build: (ports: { apiPort?: number; webPort?: number } = {}) =>
			Effect.sync(() => {
				story.tell("the app builds its shared Vite configuration");
				vi.stubEnv("PORT", engine.env.PORT);
				vi.stubEnv("VITE_PORT", engine.env.VITE_PORT);
				try {
					engine.config = appViteConfig([], [], ["/health"], ports);
				} finally {
					vi.unstubAllEnvs();
				}
			}),
		ports: () =>
			Effect.sync(() => {
				if (engine.config === undefined) {
					throw new Error("Build the Vite configuration before reading its ports");
				}
				return {
					proxyTargets: Object.fromEntries(Object.entries(engine.config.server.proxy).map(([path, proxy]) => [path, proxy.target])),
					serverPort: engine.config.server.port,
				};
			}),
	}),
});

export function environmentPorts(env: Engine["env"]) {
	return viteConfig.trait("environment", `the app's environment supplies ${JSON.stringify(env)}`, (engine) => {
		engine.env = env;
	});
}
