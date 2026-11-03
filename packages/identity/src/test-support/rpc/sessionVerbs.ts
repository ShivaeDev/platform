import { Effect } from "effect";
import type { ApiClient } from "./api.ts";
import { annotationsOf } from "./harness.ts";
import { overWebSocket } from "./overWebSocket.ts";
import { expireSession, signOut } from "./sessionLifecycle.ts";
import {
	account,
	answerOf,
	app,
	type Call,
	callerLabel,
	type Engine,
	messageHeaders,
	nameOf,
	type Person,
	transportHeaders,
} from "./sessionModel.ts";

export function sessionVerbs(engine: Engine, tell: (line: string) => void) {
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
			tell("alice and bob each ask who they are three times at once, with request ids alice-1 to alice-3 and bob-1 to bob-3");
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
			tell("alice's stored session's expiry moves into the past");
			return expireSession(engine.provider, account(engine, "alice").token);
		},
		aliceSignsOut: () => {
			tell("alice signs out through Better Auth");
			return signOut(engine.provider, transportHeaders(engine, "alice", {}));
		},
		greeting: (caller: Person | "anonymous" = "anonymous", call: Call = {}) => {
			tell(`${callerLabel(caller, call)} asks for a greeting over HTTP`);
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
		operationSpans: () =>
			Effect.sync(() =>
				app(engine)
					.spans.filter((span) => span.name.endsWith(".resolveSession") || span.name.endsWith(".betterAuthSession"))
					.map((span) => span.name),
			),
		providerCloses: () =>
			Effect.promise(async () => {
				tell("the session provider's PostgreSQL pool closes");
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
			tell(`the WebSocket client asks who it is${call.message === undefined ? "" : ` with message headers ${JSON.stringify(call.message)}`}`);
			const headers = messageHeaders(engine, call);
			return overWebSocket(engine.provider, app(engine).origin, upgrade, (client) => client.Whoami(undefined, { headers })).pipe(
				Effect.map((result) => answerOf(engine, result)),
			);
		},
		whoami: (caller: Person | "anonymous" = "anonymous", call: Call = {}) => {
			tell(`${callerLabel(caller, call)} asks who they are over HTTP`);
			return rpc(caller, call, (client, headers) => client.Whoami(undefined, { headers }));
		},
	};
}
