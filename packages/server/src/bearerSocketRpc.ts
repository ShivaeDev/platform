import { Effect, Option, Schema, type Scope } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as Socket from "effect/socket/Socket";
import { SocketAuthentication } from "@shivaedev/contract/socketAuthentication.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { recheckSession } from "@shivaedev/identity/server/recheckSession.ts";
import { resolveSession, type SessionPolicy, type SessionShape } from "@shivaedev/identity/server/session.ts";
import { makeSocketSession, SocketSession } from "@shivaedev/identity/server/socketSession.ts";

export const bearerSocketRpc = Effect.fnUntraced(function* <TSession extends SessionShape>(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>,
	policy: SessionPolicy<TSession>,
) {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const socket = yield* Effect.orDie(request.upgrade);
	const reader = yield* Effect.orDie(socket.reader);
	const writer = yield* socket.writer;
	function close(code: number, reason: string) {
		return writer.write(new Socket.CloseEvent(code, reason)).pipe(Effect.as(HttpServerResponse.empty()));
	}
	function unauthorized() {
		return close(1008, "Authentication required");
	}
	function unavailable() {
		return close(1011, "Authentication unavailable");
	}
	return yield* Effect.gen(function* () {
		const frames = yield* reader.pull.pipe(Effect.timeout("5 seconds"));
		const frame = frames[0];
		const auth =
			typeof frame === "string" && frame.length <= 8192
				? Schema.decodeUnknownOption(Schema.fromJsonString(SocketAuthentication))(frame)
				: Option.none();
		if (Option.isNone(auth)) {
			return yield* new Unauthorized({ message: "Authentication required" });
		}
		const authenticated = request.modify({ headers: Headers.set(request.headers, "authorization", `Bearer ${auth.value.token}`) });
		let buffered = frames.slice(1);
		const authenticatedSocket: Socket.Socket = {
			...socket,
			reader: Effect.succeed({
				...reader,
				pull: Effect.suspend(() => {
					if (buffered.length === 0) {
						return reader.pull;
					}
					const [first, ...rest] = buffered;
					buffered = [];
					return first === undefined ? reader.pull : Effect.succeed([first, ...rest] as const);
				}),
			}),
		};
		const transport = new Proxy(authenticated, {
			get: (target, key, receiver) => (key === "upgrade" ? Effect.succeed(authenticatedSocket) : Reflect.get(target, key, receiver)),
		});
		return yield* Effect.gen(function* () {
			const initial = yield* resolveSession(policy, Headers.empty, "$connect");
			if (Option.isNone(initial)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const session = yield* makeSocketSession(policy.streamRevalidationInterval ?? "30 seconds");
			const check = recheckSession(policy, Headers.empty, "$connect").pipe(
				Effect.flatMap((current) =>
					Option.isSome(current) && current.value.user.id === initial.value.user.id
						? Effect.void
						: Effect.fail(new Unauthorized({ message: "Authentication required" })),
				),
			);
			return yield* Effect.raceFirst(handler, session.monitor(check)).pipe(Effect.provideService(SocketSession, session));
		}).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, transport));
	}).pipe(
		Effect.catchTags({
			AuthUnavailable: unavailable,
			Forbidden: unauthorized,
			TimeoutError: unauthorized,
			Unauthorized: unauthorized,
		}),
		Effect.catchTag("SocketError", () => Effect.succeed(HttpServerResponse.empty())),
	);
});
