import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { ConfigProvider, Context, Effect, Layer, Logger, type LogLevel, Tracer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

interface Engine {
	authDown: boolean;
	readonly env: Record<string, string>;
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown; readonly traceId: string | undefined }>;
	readonly path: string;
	rateLimitEnabled: boolean;
	url: string;
}

function applicationProvider(engine: Engine) {
	return {
		id: "application-provider",
		onRequest: (request: Request) => {
			if (engine.authDown) {
				throw Object.assign(new Error("Authentication provider is down: token=provider-token", { cause: new Error("password=database-password") }), {
					cookie: "session=provider-cookie",
				});
			}
			return Promise.resolve({
				response: Response.json({
					forwardedFor: request.headers.get("x-forwarded-for"),
					realIp: request.headers.get("x-real-ip"),
				}),
			});
		},
	};
}

export const mount = storyKit({
	after: {
		*configured(engine) {
			const logger = Logger.make(({ fiber, logLevel, message }) => {
				engine.logs.push({ level: logLevel, message, traceId: Context.getOrUndefined(fiber.context, Tracer.ParentSpan)?.traceId });
			});
			const auth = yield* betterAuthMount({
				logger: { disabled: true },
				"onAPIError": { throw: true },
				plugins: [applicationProvider(engine)],
				rateLimit: { enabled: engine.rateLimitEnabled, max: 2, window: 60 },
				secret: "mount-story-secret-with-at-least-32-characters",
			}).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: engine.env }))));
			const context = yield* Layer.build(
				HttpRouter.serve(auth.routes, { disableLogger: true, middleware: HttpMiddleware.tracer }).pipe(
					Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
					Layer.provide(Logger.layer([logger])),
				),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("The auth mount needs a TCP listener");
			}
			engine.url = `http://127.0.0.1:${server.address.port}`;
		},
	},
	clock: "live",
	create: (): Engine => ({ authDown: false, env: {}, logs: [], path: `/api/auth/visitor-${crypto.randomUUID()}`, rateLimitEnabled: false, url: "" }),
	inspect: (engine) => ({ authDown: engine.authDown, url: engine.url }),
	name: "Better Auth mount",
	stages: ["configured"],
	verbs: (engine, story) => ({
		logs: () => engine.logs,
		request: (headers: Record<string, string> = {}) =>
			Effect.promise(async () => {
				story.tell("a visitor requests the mounted auth provider over HTTP");
				const response = await fetch(`${engine.url}${engine.path}`, { headers });
				return { body: await response.text(), status: response.status };
			}),
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
		engine.rateLimitEnabled = enabled;
	});
}
