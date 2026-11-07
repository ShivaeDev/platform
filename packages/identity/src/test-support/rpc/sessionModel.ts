import { type Effect, Result } from "effect";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { OriginPolicy } from "#server/origin.ts";
import type { makeApp } from "#test/rpc/api.ts";
import { type createProvider, type mintSession, ORIGIN } from "#test/rpc/harness.ts";

export const origins = {
	"an opaque origin": "null",
	"another site": "https://attacker.example",
	"the app": ORIGIN,
	"the Capacitor shell": "capacitor://localhost",
} as const;

export type OriginName = keyof typeof origins;

export type Person = "alice" | "bob";

export interface Call {
	readonly from?: OriginName | "nowhere";
	readonly message?: { readonly cookieOf?: Person; readonly origin?: OriginName; readonly originHeader?: string };
	readonly requestId?: string;
}

type Account = Effect.Success<ReturnType<typeof mintSession>>;

export interface Engine {
	readonly accounts: Map<Person, Account>;
	app?: ReturnType<typeof makeApp>;
	readonly close: () => Promise<void>;
	origin?: OriginPolicy;
	readonly provider: Effect.Success<ReturnType<typeof createProvider>>;
	upgrade?: Record<string, string>;
}

export function account(engine: Engine, person: Person) {
	const value = engine.accounts.get(person);
	if (value === undefined) {
		throw new Error(`${person} has no minted session`);
	}
	return value;
}

export function app(engine: Engine) {
	if (engine.app === undefined) {
		throw new Error("The story has not chosen an origin policy");
	}
	return engine.app;
}

export function nameOf(engine: Engine, id: string) {
	return [...engine.accounts].find(([, { userId }]) => userId === id)?.[0] ?? id;
}

export function answerOf(engine: Engine, result: Result.Result<string, unknown>) {
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

export function messageHeaders(engine: Engine, call: Call) {
	const message = call.message ?? {};
	return {
		...(message.origin === undefined ? {} : { [message.originHeader ?? "origin"]: origins[message.origin] }),
		...(message.cookieOf === undefined ? {} : { cookie: account(engine, message.cookieOf).cookie }),
	};
}

export function transportHeaders(engine: Engine, caller: Person | "anonymous", call: Call) {
	const from = call.from ?? "the app";
	const cookie = caller === "anonymous" ? undefined : account(engine, caller).cookie;
	return {
		...(from === "nowhere" ? {} : { origin: origins[from] }),
		...(cookie === undefined ? {} : { cookie }),
		...(call.requestId === undefined ? {} : { "x-request-id": call.requestId }),
	};
}

export function callerLabel(caller: string, call: Call) {
	const from = call.from === "nowhere" ? "without an origin" : `from ${call.from ?? "the app"}`;
	const message = call.message === undefined ? "" : ` with message headers ${JSON.stringify(call.message)}`;
	return `${caller} ${from}${message}`;
}
