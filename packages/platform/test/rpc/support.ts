import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Layer, Logger, References, Tracer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { expect } from "vitest";

export const origin = "http://localhost:3000";

export interface LogRecord {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly level: string;
	readonly message: unknown;
}

export const recorder = () => {
	const logs: Array<LogRecord> = [];
	const spans: Array<Tracer.NativeSpan> = [];
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
};

export const createProvider = async () => {
	const database = new DatabaseSync(":memory:");
	const options = {
		baseURL: origin,
		database,
		emailAndPassword: { enabled: true },
		secret: "integration-only-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	};
	await (await getMigrations(options)).runMigrations();
	const auth = betterAuth(options);
	let lookups = 0;
	const getSession = (headers: Headers) => {
		lookups += 1;
		return auth.api.getSession({ headers });
	};
	return { auth, database, getSession, lookups: () => lookups };
};

export type Provider = Awaited<ReturnType<typeof createProvider>>;

export const signup = async (provider: Provider, name: string) => {
	const response = await provider.auth.handler(
		new Request(`${origin}/api/auth/sign-up/email`, {
			body: JSON.stringify({ email: `${name}@example.test`, name, password: "example-password-123" }),
			headers: { "content-type": "application/json", origin },
			method: "POST",
		}),
	);
	expect(response.status).toBe(200);
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	const session = await provider.auth.api.getSession({ headers: new Headers({ cookie }) });
	expect(session).not.toBeNull();
	return { cookie, userId: session?.user.id ?? "" };
};

export const rpcHttp = <Rpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<Rpcs>) => RpcServer.layerHttp({ group, path: "/rpc", protocol: "http" });

export const serve = (layer: Layer.Layer<never, never, HttpRouter.HttpRouter | RpcSerialization.RpcSerialization>) =>
	HttpRouter.toWebHandler(layer.pipe(Layer.provide(RpcSerialization.layerJson)), { disableLogger: true });

export const httpClient = (app: { readonly handler: (request: Request) => Promise<Response> }, headers: Readonly<Record<string, string>>) =>
	RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
		url: `${origin}/rpc`,
	}).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
	);

export const annotationsOf = (logs: ReadonlyArray<LogRecord>, message: string) =>
	logs.filter((log) => (Array.isArray(log.message) ? log.message.includes(message) : log.message === message)).map((log) => log.annotations);
