import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inspect, promisify } from "node:util";
import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { emptyMount, type MountEngine, PROVIDER_SECRETS, type ProviderView, startMountHost } from "./mountHost.ts";

const clients = { alice: "198.51.100.10", bob: "198.51.100.20" } as const;

const SPOOFED_HOP = "192.0.2.1";

const PEER = "127.0.0.1";

type Client = keyof typeof clients;

type Answer = "accepted" | "forbidden" | "rate limited" | "unavailable" | `HTTP ${number}`;

function answerOf(status: number): Answer {
	switch (status) {
		case HttpStatus.fromLiteral("OK"):
		case HttpStatus.fromLiteral("NoContent"):
			return "accepted";
		case HttpStatus.fromLiteral("Forbidden"):
			return "forbidden";
		case HttpStatus.fromLiteral("TooManyRequests"):
			return "rate limited";
		case HttpStatus.fromLiteral("ServiceUnavailable"):
			return "unavailable";
		default:
			return `HTTP ${status}`;
	}
}

function clientIpHeader(engine: MountEngine) {
	return engine.env.AUTH_CLIENT_IP_HEADER ?? "x-forwarded-for";
}

function visit(engine: MountEngine, host: number, headers: Record<string, string>) {
	return Effect.promise(async () => {
		const response = await fetch(`${engine.urls[host]}/api/auth/visitor`, { headers });
		await response.text();
		engine.lastAnswer = answerOf(response.status);
		return engine.lastAnswer;
	});
}

function clientHeaders(engine: MountEngine, client: Client | undefined): Record<string, string> {
	return client === undefined ? {} : { "x-forwarded-for": SPOOFED_HOP, [clientIpHeader(engine)]: clients[client] };
}

function clientNamed(address: string | null) {
	if (address === PEER) {
		return "the connecting peer";
	}
	if (address === SPOOFED_HOP) {
		return "the spoofed hop";
	}
	return Object.entries(clients).find(([, ip]) => ip === address)?.[0] ?? address;
}

function errorLogs(engine: MountEngine) {
	return engine.logs.filter((log) => log.level === "Error");
}

function seen(engine: MountEngine): ProviderView {
	if (engine.providerView === undefined) {
		throw new Error("No request has reached the auth provider");
	}
	return engine.providerView;
}

const signUpThroughProxy = Effect.fnUntraced(function* (engine: MountEngine, origin: string, authority: string) {
	const proxy = yield* forwardingProxy(engine.urls[0] ?? "", { headers: { host: authority } });
	return yield* Effect.promise(async () => {
		const response = await fetch(`${proxy.url}/api/auth/sign-up/email`, {
			body: JSON.stringify({ email: "alice@example.test", name: "Alice", password: "story-password-123" }),
			headers: { "content-type": "application/json", origin },
			method: "POST",
		});
		await response.text();
		return answerOf(response.status);
	});
});

export const mount = storyKit({
	after: { configured: startMountHost },
	clock: "live",
	create: emptyMount,
	inspect: (engine) => ({ authDown: engine.authDown, urls: engine.urls }),
	name: "Better Auth mount",
	stages: ["configured"],
	verbs: (engine, story) => ({
		clientAuthSaw: () => Effect.sync(() => clientNamed(seen(engine).address)),
		errorLogs: () =>
			Effect.sync(() => errorLogs(engine).map(({ message, traceId }) => ({ message: Array.isArray(message) ? message[0] : message, traceId }))),
		forwardedHeadersAuthSaw: () => Effect.sync(() => seen(engine).forwardedHeaders),
		lastAnswer: () => Effect.sync(() => engine.lastAnswer),
		loggedFailure: () =>
			Effect.sync(() => {
				const [log] = errorLogs(engine);
				const detail = Array.isArray(log?.message) ? log.message[1] : undefined;
				return { cause: detail?.cause?.message, cookie: detail?.cookie, message: detail?.message };
			}),
		logsMentionProviderSecrets: () => Effect.sync(() => PROVIDER_SECRETS.filter((secret) => inspect(engine.logs, { depth: 20 }).includes(secret))),
		productionVisit: () =>
			Effect.promise(async () => {
				story.tell("a visitor requests auth on a production host without a proxy");
				const { stdout } = await promisify(execFile)(
					process.execPath,
					["--conditions=source", fileURLToPath(import.meta.resolve("#test/better-auth/mountProduction.ts"))],
					{ env: { "NODE_ENV": "production" } },
				);
				const { address, logs, status } = JSON.parse(stdout);
				return {
					answer: answerOf(status),
					client: clientNamed(address),
					warnings: logs
						.filter(({ level }: { readonly level: string }) => level === "warn")
						.map(({ message }: { readonly message: string }) => message),
				};
			}),
		providerFails: () =>
			Effect.sync(() => {
				story.tell("the authentication provider throws an error carrying a token, a password and a cookie");
				engine.authDown = true;
			}),
		request: (client?: Client) => {
			story.tell(
				client === undefined
					? "a visitor requests auth"
					: `${client} at ${clients[client]} requests auth through the proxy at ${PEER}, which names her in ${clientIpHeader(engine)}${clientIpHeader(engine) === "x-forwarded-for" ? "" : ` and forwards a spoofed x-forwarded-for of ${SPOOFED_HOP}`}`,
			);
			return visit(engine, 0, clientHeaders(engine, client));
		},
		requestInTrace: (traceId: string) => {
			story.tell(`a visitor requests auth inside trace ${traceId}`);
			return visit(engine, 0, { traceparent: `00-${traceId}-1234567890abcdef-01` });
		},
		requestSecondHost: () => {
			story.tell("a visitor requests auth from the second host");
			return visit(engine, 1, {});
		},
		signUp: (origin: string, authority = new URL(origin).host) => {
			story.tell(`alice signs up from ${origin} through a development proxy that sends Host ${authority}`);
			return signUpThroughProxy(engine, origin, authority);
		},
		startSecondHost: () => {
			story.tell("a second auth host starts in the same process");
			return startMountHost(engine);
		},
		storageCalls: () =>
			Effect.sync(() => ({ clients: new Set(engine.consumed.map(({ key }) => key)).size, rules: engine.consumed.map(({ rule }) => rule) })),
		useAllowance: (client?: Client) => {
			story.tell(`${client ?? "a visitor"} uses up the allowance of two auth requests a minute`);
			return Effect.all([visit(engine, 0, clientHeaders(engine, client)), visit(engine, 0, clientHeaders(engine, client))]);
		},
	}),
});

export function authOptions(line: string, options: Pick<BetterAuthOptions, "baseURL" | "trustedOrigins">) {
	return mount.trait("configured", line, (engine) => {
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

export const applicationStorage = mount.trait("configured", "the app supplies rate-limit storage that allows every request", (engine) => {
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
