import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { emptyMount, type MountEngine, startMountHost } from "./mountHost.ts";

export const mount = storyKit({
	after: { configured: startMountHost },
	clock: "live",
	create: emptyMount,
	inspect: (engine) => ({ authDown: engine.authDown, urls: engine.urls }),
	name: "Better Auth mount",
	stages: ["configured"],
	verbs: (engine, story) => ({
		consumed: () => engine.consumed,
		logs: () => engine.logs,
		productionRequest: () =>
			Effect.promise(async () => {
				story.tell("a visitor requests auth on a production host without a proxy");
				const { stdout } = await promisify(execFile)(
					process.execPath,
					["--conditions=source", fileURLToPath(import.meta.resolve("#test/better-auth/mountProduction.ts"))],
					{ env: { "NODE_ENV": "production" } },
				);
				return JSON.parse(stdout);
			}),
		request: (headers: Record<string, string> = {}, host = 0) =>
			Effect.promise(async () => {
				story.tell("a visitor requests the mounted auth provider over HTTP");
				const response = await fetch(`${engine.urls[host]}/api/auth/visitor`, { headers });
				return { body: await response.text(), status: response.status };
			}),
		signIn: (origin: string) => emailRequest(engine, "sign-in", origin, story.tell),
		signUp: (origin: string, authority?: string) => emailRequest(engine, "sign-up", origin, story.tell, authority),
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

const emailRequest = Effect.fnUntraced(function* (
	engine: MountEngine,
	action: string,
	origin: string,
	tell: (line: string) => void,
	authority = new URL(origin).host,
) {
	tell(`Alice sends ${action} from ${origin} through the development proxy`);
	const proxy = yield* forwardingProxy(engine.urls[0] ?? "", { headers: { host: authority } });
	return yield* Effect.promise(async () => {
		const response = await fetch(`${proxy.url}/api/auth/${action}/email`, {
			body: JSON.stringify({ email: "alice@example.test", name: "Alice", password: "story-password-123" }),
			headers: { "content-type": "application/json", cookie: "browser-preference=story", origin },
			method: "POST",
		});
		const body = await response.text();
		return { body: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(body) : body, status: response.status };
	});
});

export function authOptions(options: Pick<BetterAuthOptions, "baseURL" | "trustedOrigins">) {
	return mount.trait("configured", "the app replaces the auth development defaults", (engine) => {
		Object.assign(engine.authOptions, options);
	});
}

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
