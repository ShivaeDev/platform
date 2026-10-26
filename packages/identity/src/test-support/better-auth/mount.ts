import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type MountEngine, startMountHost } from "./mountHost.ts";

export const mount = storyKit({
	after: { configured: startMountHost },
	clock: "live",
	create: (): MountEngine => ({ authDown: false, consumed: [], env: {}, logs: [], rateLimit: { enabled: false, max: 2, window: 60 }, urls: [] }),
	inspect: (engine) => ({ authDown: engine.authDown, urls: engine.urls }),
	name: "Better Auth mount",
	stages: ["configured"],
	verbs: (engine, story) => ({
		consumed: () => engine.consumed,
		logs: () => engine.logs,
		request: (headers: Record<string, string> = {}, host = 0) =>
			Effect.promise(async () => {
				story.tell("a visitor requests the mounted auth provider over HTTP");
				const response = await fetch(`${engine.urls[host]}/api/auth/visitor`, { headers });
				return { body: await response.text(), status: response.status };
			}),
		startHost: () => {
			story.tell("another auth host starts in the same process");
			return startMountHost(engine);
		},
		stopAuth: () =>
			Effect.sync(() => {
				story.tell("the authentication provider becomes unavailable");
				engine.authDown = true;
			}),
	}),
});

export function environment(env: Record<string, string>) {
	return mount.trait("configured", `auth configuration is ${JSON.stringify(env)}`, (engine) => {
		Object.assign(engine.env, env);
	});
}

export function applicationRateLimit(enabled: boolean) {
	return mount.trait("configured", `the application's Better Auth options ${enabled ? "enable" : "disable"} rate limiting`, (engine) => {
		engine.rateLimit.enabled = enabled;
	});
}

export const applicationStorage = mount.trait("configured", "the app supplies its own rate-limit storage", (engine) => {
	engine.rateLimit.customStorage = {
		consume: (key, rule) => {
			engine.consumed.push({ key, rule });
			return Promise.resolve({ allowed: true, retryAfter: null });
		},
	};
});

export const memoryStorage = mount.trait("configured", "the app explicitly selects memory rate-limit storage", (engine) => {
	engine.rateLimit.storage = "memory";
});
