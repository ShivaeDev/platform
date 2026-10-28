import { Effect, Option, Result } from "effect";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type OriginPolicy, trustedOrigins } from "#server/origin.ts";
import { type ApiClient, makeApp } from "./api.ts";
import { annotationsOf, createProvider, ORIGIN, signup } from "./harness.ts";
import { overWebSocket } from "./overWebSocket.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { expireSession, signOut } from "./sessionLifecycle.ts";

export const origins = {
	"an opaque origin": "null",
	"another site": "https://attacker.example",
	"the app": ORIGIN,
	"the Capacitor shell": "capacitor://localhost",
} as const;

type OriginName = keyof typeof origins;

type Person = "alice" | "bob";

interface Call {
	readonly from?: OriginName | "nowhere";
	readonly message?: { readonly cookieOf?: Person; readonly origin?: OriginName; readonly originHeader?: string };
	readonly requestId?: string;
}

type Account = Awaited<ReturnType<typeof signup>>;

interface Engine {
	readonly accounts: Map<Person, Account>;
	app?: ReturnType<typeof makeApp>;
	readonly close: () => Promise<void>;
	origin?: OriginPolicy;
	readonly provider: Effect.Success<ReturnType<typeof createProvider>>;
	upgrade?: Record<string, string>;
}

function account(engine: Engine, person: Person) {
	const value = engine.accounts.get(person);
	if (value === undefined) {
		throw new Error(`${person} has not signed up`);
	}
	return value;
}

function app(engine: Engine) {
	if (engine.app === undefined) {
		throw new Error("The story has not chosen an origin policy");
	}
	return engine.app;
}

function nameOf(engine: Engine, id: string) {
	return [...engine.accounts].find(([, { userId }]) => userId === id)?.[0] ?? id;
}

function answerOf(engine: Engine, result: Result.Result<string, unknown>) {
	if (Result.isSuccess(result)) {
		return [...engine.accounts].reduce((answer, [person, { userId }]) => answer.replaceAll(userId, person), result.success);
	}
	const error = result.failure;
	if (error instanceof Forbidden) {
		return error.message === "Origin not allowed" ? "forbidden origin" : `forbidden: ${error.message}`;
	}
	if (error instanceof Unauthorized) {
		return "unauthorized";
	}
	if (error instanceof AuthUnavailable) {
		return error.message === "Authentication is temporarily unavailable" ? "auth unavailable" : `auth unavailable: ${error.message}`;
	}
	return `failed: ${String(error)}`;
}

function messageHeaders(engine: Engine, call: Call) {
	const message = call.message ?? {};
	return {
		...(message.origin === undefined ? {} : { [message.originHeader ?? "origin"]: origins[message.origin] }),
		...(message.cookieOf === undefined ? {} : { cookie: account(engine, message.cookieOf).cookie }),
	};
}

function transportHeaders(engine: Engine, caller: Person | "anonymous", call: Call) {
	const from = call.from ?? "the app";
	const cookie = caller === "anonymous" ? undefined : account(engine, caller).cookie;
	return {
		...(from === "nowhere" ? {} : { origin: origins[from] }),
		...(cookie === undefined ? {} : { cookie }),
		...(call.requestId === undefined ? {} : { "x-request-id": call.requestId }),
	};
}

function callerLabel(caller: string, call: Call) {
	const from = call.from === "nowhere" ? "without an origin" : `from ${call.from ?? "the app"}`;
	const message = call.message === undefined ? "" : ` with message headers ${JSON.stringify(call.message)}`;
	return `${caller} ${from}${message}`;
}

const browser = trustedOrigins({ allow: [ORIGIN, origins["the Capacitor shell"]], missing: "reject" });

export const sessions = storyKit({
	after: {
		policy(engine) {
			if (engine.origin !== undefined) {
				engine.app = makeApp(engine.provider, engine.origin);
			}
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const provider = yield* createProvider(database.url);
		const engine: Engine = { accounts: new Map(), close: provider.close, provider };
		yield* Effect.addFinalizer(() => Effect.promise(async () => engine.app?.app.dispose()));
		return engine;
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], lookups: engine.provider.lookups() }),
	layer: postgres,
	name: "RPC session",
	runIf: databaseUrl !== undefined,
	stages: ["policy", "accounts", "upgrade"],
	verbs: (engine, story) => {
		function rpc(
			caller: Person | "anonymous",
			call: Call,
			method: (client: ApiClient, headers: Record<string, string>) => Effect.Effect<string, unknown>,
		) {
			return app(engine)
				.call(transportHeaders(engine, caller, call), (client) => method(client, messageHeaders(engine, call)))
				.pipe(Effect.map((result) => answerOf(engine, result)));
		}
		return {
			aliceAndBobCallAtOnce: () => {
				story.tell("alice and bob each ask who they are three times at once, with request ids alice-1 to alice-3 and bob-1 to bob-3");
				const requests = (["alice", "bob"] as const).flatMap((person) => [1, 2, 3].map((index) => ({ person, requestId: `${person}-${index}` })));
				return Effect.all(
					requests.map(({ person, requestId }) =>
						rpc(person, { requestId }, (client, headers) => client.Whoami(undefined, { headers })).pipe(
							Effect.map((answer) => [requestId, answer] as const),
						),
					),
					{ concurrency: "unbounded" },
				).pipe(Effect.map(Object.fromEntries));
			},
			aliceSessionExpires: () => {
				story.tell("alice's stored session's expiry moves into the past");
				return expireSession(engine.provider, account(engine, "alice").token);
			},
			aliceSignsOut: () => {
				story.tell("alice signs out through Better Auth");
				return signOut(engine.provider, transportHeaders(engine, "alice", {}));
			},
			greeting: (caller: Person | "anonymous" = "anonymous", call: Call = {}) => {
				story.tell(`${callerLabel(caller, call)} asks for a greeting over HTTP`);
				return rpc(caller, call, (client, headers) => client.Greeting(undefined, { headers }));
			},
			handledLogsByRequest: () =>
				Effect.sync(() =>
					Object.fromEntries(
						annotationsOf(app(engine).logs, "handled").map((annotations) => [
							annotations.requestId,
							{ method: annotations["rpc.method"], user: nameOf(engine, String(annotations.userId)) },
						]),
					),
				),
			providerCloses: () =>
				Effect.promise(async () => {
					story.tell("the session provider's PostgreSQL pool closes");
					await engine.close();
				}),
			providerFailureLogs: () =>
				Effect.sync(() =>
					app(engine)
						.logs.filter((log) => log.level === "Error" && Array.isArray(log.message) && log.message.includes("Authentication provider failed"))
						.map(({ annotations }) => ({ method: annotations["rpc.method"] })),
				),
			rpcFailures: () => Effect.sync(() => annotationsOf(app(engine).logs, "RPC failure").map((annotations) => annotations["rpc.failure"])),
			sessionLookups: () => Effect.sync(() => engine.provider.lookups()),
			spansByRequest: () =>
				Effect.sync(() =>
					Object.fromEntries(
						app(engine)
							.spans.filter((span) => span.attributes.has("request.id"))
							.map((span) => [span.attributes.get("request.id"), { name: span.name, user: nameOf(engine, String(span.attributes.get("user.id"))) }]),
					),
				),
			websocketWhoami: (call: Pick<Call, "message"> = {}) => {
				const upgrade = engine.upgrade;
				if (upgrade === undefined) {
					throw new Error("No WebSocket upgrade has been opened");
				}
				story.tell(`the WebSocket client asks who it is${call.message === undefined ? "" : ` with message headers ${JSON.stringify(call.message)}`}`);
				const headers = messageHeaders(engine, call);
				return overWebSocket(engine.provider, app(engine).origin, upgrade, (client) => client.Whoami(undefined, { headers })).pipe(
					Effect.map((result) => answerOf(engine, result)),
				);
			},
			whoami: (caller: Person | "anonymous" = "anonymous", call: Call = {}) => {
				story.tell(`${callerLabel(caller, call)} asks who they are over HTTP`);
				return rpc(caller, call, (client, headers) => client.Whoami(undefined, { headers }));
			},
		};
	},
});

function policy(line: string, origin: OriginPolicy) {
	return sessions.trait("policy", line, (engine) => {
		engine.origin = origin;
	});
}

export const browserOrigins = policy("RPC trusts the app and the Capacitor shell, and refuses calls without an origin", browser);

export const appOrMissingOrigin = policy("RPC trusts the app and calls without an origin", trustedOrigins({ allow: [ORIGIN], missing: "allow" }));

export const greetingsWithoutOrigin = policy("RPC trusts the app, and lets only greetings arrive without an origin", (request) =>
	Option.match(request.origin, { onNone: () => request.rpc === "Greeting", onSome: (value) => value === ORIGIN }),
);

export function signedUp(...people: Person[]) {
	return sessions.trait("accounts", `${people.join(" and ")} sign up with Better Auth`, function* (engine) {
		for (const person of people) {
			engine.accounts.set(person, yield* Effect.promise(() => signup(engine.provider, person)));
		}
	});
}

export function webSocketOpened(caller: Person | "anonymous", from: OriginName) {
	return sessions.trait("upgrade", `${caller === "anonymous" ? "an anonymous caller" : caller} opens the RPC WebSocket from ${from}`, (engine) => {
		engine.upgrade = transportHeaders(engine, caller, { from });
	});
}
