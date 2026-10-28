import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthOptions, BetterAuthRateLimitOptions } from "better-auth";
import { ConfigProvider, Context, Effect, Layer, Logger, type LogLevel, Tracer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { PEER_IP_HEADER } from "#server/better-auth/clientIp.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

export const FORWARDED_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

export const PROVIDER_SECRETS = ["provider-token", "database-password", "provider-cookie"] as const;

export interface ProviderView {
	readonly address: string | null;
	readonly forwardedHeaders: readonly string[];
}

export interface MountEngine {
	authDown: boolean;
	readonly authOptions: Pick<BetterAuthOptions, "baseURL" | "trustedOrigins">;
	readonly consumed: Array<{ readonly key: string; readonly rule: { readonly max: number; readonly window: number } }>;
	readonly env: Record<string, string>;
	lastAnswer?: string;
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown; readonly traceId: string | undefined }>;
	readonly providerLogs: Array<{ level: string; message: string }>;
	providerView?: ProviderView;
	readonly rateLimit: BetterAuthRateLimitOptions;
	readonly urls: string[];
}

export function emptyMount(): MountEngine {
	return {
		authDown: false,
		authOptions: {},
		consumed: [],
		env: {},
		logs: [],
		providerLogs: [],
		rateLimit: { max: 2, window: 60 },
		urls: [],
	};
}

function applicationProvider(engine: MountEngine) {
	return {
		id: "application-provider",
		onRequest: (request: Request) => {
			if (new URL(request.url).pathname !== "/api/auth/visitor") {
				return Promise.resolve();
			}
			if (engine.authDown) {
				throw Object.assign(new Error("Authentication provider is down: token=provider-token", { cause: new Error("password=database-password") }), {
					cookie: "session=provider-cookie",
				});
			}
			engine.providerView = {
				address: request.headers.get(PEER_IP_HEADER),
				forwardedHeaders: FORWARDED_HEADERS.filter((header) => request.headers.has(header)),
			};
			return Promise.resolve({ response: new Response(null, { status: 204 }) });
		},
	};
}

export const startMountHost = Effect.fn("AuthMountStory.startMountHost")(function* (engine: MountEngine) {
	const logger = Logger.make(({ fiber, logLevel, message }) => {
		engine.logs.push({ level: logLevel, message, traceId: Context.getOrUndefined(fiber.context, Tracer.ParentSpan)?.traceId });
	});
	const auth = yield* betterAuthMount({
		...engine.authOptions,
		advanced: { disableOriginCheck: false },
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { log: (level, message) => engine.providerLogs.push({ level, message }) },
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
