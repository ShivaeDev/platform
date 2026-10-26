import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthRateLimitOptions } from "better-auth";
import { ConfigProvider, Context, Effect, Layer, Logger, type LogLevel, Tracer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { betterAuthMount } from "#server/better-auth/mount.ts";

export interface MountEngine {
	authDown: boolean;
	readonly consumed: Array<{ readonly key: string; readonly rule: { readonly max: number; readonly window: number } }>;
	readonly env: Record<string, string>;
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown; readonly traceId: string | undefined }>;
	readonly rateLimit: BetterAuthRateLimitOptions;
	readonly urls: string[];
}

function applicationProvider(engine: MountEngine) {
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

export const startMountHost = Effect.fn("AuthMountStory.startMountHost")(function* (engine: MountEngine) {
	const logger = Logger.make(({ fiber, logLevel, message }) => {
		engine.logs.push({ level: logLevel, message, traceId: Context.getOrUndefined(fiber.context, Tracer.ParentSpan)?.traceId });
	});
	const auth = yield* betterAuthMount({
		logger: { disabled: true },
		"onAPIError": { throw: true },
		plugins: [applicationProvider(engine)],
		rateLimit: engine.rateLimit,
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
	engine.urls.push(`http://127.0.0.1:${server.address.port}`);
});
