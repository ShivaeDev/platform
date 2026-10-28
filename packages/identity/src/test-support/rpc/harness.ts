import { betterAuth } from "better-auth";
import { Effect, Layer, Logger, Redacted, References, Tracer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { Pool } from "pg";

export const ORIGIN = "http://localhost:3000";

export interface LogRecord {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly level: string;
	readonly message: unknown;
}

export function recorder() {
	const logs: LogRecord[] = [];
	const spans: Tracer.NativeSpan[] = [];
	const logger = Logger.make((options) => {
		logs.push({
			annotations: options.fiber.getRef(References.CurrentLogAnnotations),
			level: options.logLevel,
			message: options.message,
		});
	});
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	const layer = Layer.mergeAll(Logger.layer([logger]), Layer.succeed(Tracer.Tracer, tracer), Layer.succeed(References.MinimumLogLevel, "All"));
	return { layer, logs, spans };
}

export const createProvider = Effect.fnUntraced(function* (url: Redacted.Redacted<string>) {
	const database = new Pool({ connectionString: Redacted.value(url), max: 2 });
	const disconnected = new Set<Promise<void>>();
	database.on("connect", (client) => {
		const closed = new Promise<void>((resolve) =>
			client.once("end", () => {
				disconnected.delete(closed);
				resolve();
			}),
		);
		disconnected.add(closed);
	});
	let closing: Promise<void> | undefined;
	function close() {
		closing ??= (async () => {
			// pg-pool can finish ending before its idle clients disconnect.
			await database.end();
			await Promise.all(disconnected);
		})();
		return closing;
	}
	yield* Effect.addFinalizer(() => Effect.promise(close));
	const options = {
		"baseURL": ORIGIN,
		database,
		emailAndPassword: { enabled: true },
		secret: "integration-only-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	};
	const auth = betterAuth(options);
	let lookups = 0;
	function getSession(headers: Headers) {
		lookups += 1;
		return auth.api.getSession({ headers });
	}
	return { auth, close, database, getSession, lookups: () => lookups };
});

export type Provider = Effect.Success<ReturnType<typeof createProvider>>;

export async function signup(provider: Provider, name: string) {
	const response = await provider.auth.handler(
		new Request(`${ORIGIN}/api/auth/sign-up/email`, {
			body: JSON.stringify({ email: `${name}@example.test`, name, password: "example-password-123" }),
			headers: { "content-type": "application/json", origin: ORIGIN },
			method: "POST",
		}),
	);
	if (response.status !== HttpStatus.fromLiteral("OK")) {
		throw new Error(`Better Auth sign-up failed: HTTP ${response.status}`);
	}
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	const session = await provider.auth.api.getSession({ headers: new Headers({ cookie }) });
	if (session === null) {
		throw new Error("Better Auth sign-up did not create a session");
	}
	return { cookie, token: session.session.token, userId: session.user.id };
}

export function rpcHttp<TRpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<TRpcs>) {
	return RpcServer.layerHttp({ group, path: "/rpc", protocol: "http" });
}

export function serve(layer: Layer.Layer<never, never, HttpRouter.HttpRouter | RpcSerialization.RpcSerialization>) {
	return HttpRouter.toWebHandler(layer.pipe(Layer.provide(RpcSerialization.layerJson)), { disableLogger: true });
}

export function httpClient(app: { readonly handler: (request: Request) => Promise<Response> }, headers: Readonly<Record<string, string>>) {
	return RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
		url: `${ORIGIN}/rpc`,
	}).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
	);
}

export function annotationsOf(logs: readonly LogRecord[], message: string) {
	return logs.filter((log) => (Array.isArray(log.message) ? log.message.includes(message) : log.message === message)).map((log) => log.annotations);
}
