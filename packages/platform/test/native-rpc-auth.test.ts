import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { Rpc, RpcClient, RpcGroup, RpcMiddleware, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { expect, test } from "vitest";

const origin = "http://localhost:3000";
class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", {}) {}
class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {}) {}
class Principal extends Context.Service<Principal, { readonly userId: string }>()("auth-example/Principal") {}
class Authentication extends RpcMiddleware.Service<Authentication, { provides: Principal }>()("auth-example/Authentication", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}
const Account = RpcGroup.make(
	Rpc.make("ReadOwnAccount", {
		payload: { userId: Schema.String },
		success: Schema.String,
		error: Forbidden,
	}),
).middleware(Authentication);

const createProvider = async () => {
	const database = new DatabaseSync(":memory:");
	const options = {
		database,
		baseURL: origin,
		secret: "integration-only-secret-with-at-least-32-characters",
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
	};
	await (await getMigrations(options)).runMigrations();
	const auth = betterAuth(options);
	return { database, auth };
};

const createRpc = (auth: Awaited<ReturnType<typeof createProvider>>["auth"]) => {
	const authentication = Layer.succeed(Authentication, (effect) =>
		Effect.gen(function* () {
			const request = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest);
			if (Option.isNone(request)) return yield* new Forbidden();
			const { headers } = request.value;
			if (headers.origin !== origin) return yield* new Forbidden();
			const session = yield* Effect.tryPromise({
				try: () => auth.api.getSession({ headers: new Headers(headers) }),
				catch: () => new AuthUnavailable(),
			});
			if (session === null) return yield* new Unauthorized();
			return yield* Effect.provideService(effect, Principal, {
				userId: session.user.id,
			});
		}),
	);
	const handlers = Account.toLayer({
		ReadOwnAccount: ({ userId }) =>
			Effect.gen(function* () {
				const principal = yield* Principal;
				if (principal.userId !== userId) return yield* new Forbidden();
				return principal.userId;
			}),
	});
	return HttpRouter.toWebHandler(
		RpcServer.layerHttp({
			group: Account,
			path: "/rpc",
			protocol: "http",
		}).pipe(Layer.provide(handlers), Layer.provide(authentication), Layer.provide(RpcSerialization.layerJson)),
		{ disableLogger: true },
	);
};

test("BetterAuth issued cookies authenticate isolated native RPC requests and honor expiry and revocation", async () => {
	const { database, auth } = await createProvider();
	const app = createRpc(auth);
	const signup = async (name: string) => {
		const response = await auth.handler(
			new Request(`${origin}/api/auth/sign-up/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin },
				body: JSON.stringify({
					name,
					email: `${name}@example.test`,
					password: "example-password-123",
				}),
			}),
		);
		expect(response.status).toBe(200);
		const cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		expect(cookie).toContain("better-auth.session_token=");
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		if (session === null) throw new Error("Sign-up did not create a session");
		return { cookie, userId: session.user.id, token: session.session.token };
	};
	const read = (cookie: string, userId: string, requestOrigin = origin) =>
		Effect.runPromise(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Account);
				return yield* Effect.result(client.ReadOwnAccount({ userId }));
			}).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						url: `${origin}/rpc`,
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin: requestOrigin })),
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
				),
				Effect.provideService(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init))),
				Effect.scoped,
			),
		);
	try {
		const alice = await signup("alice");
		const bob = await signup("bob");
		const [aliceResult, bobResult] = await Promise.all([read(alice.cookie, alice.userId), read(bob.cookie, bob.userId)]);
		expect(aliceResult).toMatchObject({
			_tag: "Success",
			success: alice.userId,
		});
		expect(bobResult).toMatchObject({ _tag: "Success", success: bob.userId });
		expect(await read(alice.cookie, bob.userId)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
		expect(await read("", alice.userId)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
		expect(await read(`${alice.cookie}tampered`, alice.userId)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
		expect(await read(alice.cookie, alice.userId, "https://attacker.example")).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
		expect(await read(alice.cookie, alice.userId, "")).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
		const signout = await auth.handler(
			new Request(`${origin}/api/auth/sign-out`, {
				method: "POST",
				headers: {
					cookie: alice.cookie,
					origin,
					"content-type": "application/json",
				},
				body: "{}",
			}),
		);
		expect(signout.status).toBe(200);
		expect(await read(alice.cookie, alice.userId)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
		database.prepare('UPDATE "session" SET "expiresAt" = ? WHERE token = ?').run(Date.UTC(2000, 0, 1), bob.token);
		expect(await read(bob.cookie, bob.userId)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
	} finally {
		await app.dispose();
		database.close();
	}
}, 20_000);
