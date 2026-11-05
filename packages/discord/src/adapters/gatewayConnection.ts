import { Deferred, Effect, Redacted, Schema } from "effect";
import { Socket } from "effect/socket";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { decodeData, decodeFrame, type GatewayDispatch, type GatewayFrame, type GatewaySession, Hello, Ready, reconnect } from "#gatewayProtocol.ts";

export function gatewayConnection(session: GatewaySession, dispatch: (event: GatewayDispatch) => Effect.Effect<void>) {
	return Effect.gen(function* () {
		const socket = yield* Socket.Socket;
		const token = yield* DiscordToken;
		const { intents } = yield* DiscordConfig;
		const reader = yield* socket.reader;
		const writer = yield* socket.writer;
		const failed = yield* Deferred.make<never, Socket.SocketError>();
		let acknowledged = true;
		const send = Effect.fnUntraced(function* (op: number, d: unknown) {
			const frame = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ d, op }).pipe(Effect.orDie);
			yield* writer.write(frame);
		});
		const startHeartbeat = Effect.fnUntraced(function* (interval: number) {
			const pulse = Effect.gen(function* () {
				while (true) {
					yield* Effect.sleep(interval);
					if (!acknowledged) {
						return yield* reconnect();
					}
					acknowledged = false;
					yield* send(1, session.sequence);
				}
			});
			yield* pulse.pipe(
				Effect.catch((error) => Deferred.fail(failed, error)),
				Effect.forkScoped,
			);
		});
		const hello = Effect.fnUntraced(function* (data: unknown) {
			const { heartbeatInterval } = yield* decodeData(Hello, data);
			const payload =
				session.sessionId === undefined
					? { intents, properties: { browser: "platform", device: "platform", os: "linux" }, token: Redacted.value(token) }
					: { seq: session.sequence, "session_id": session.sessionId, token: Redacted.value(token) };
			yield* send(session.sessionId === undefined ? 2 : 6, payload);
			yield* startHeartbeat(heartbeatInterval);
		});
		const deliver = Effect.fnUntraced(function* (frame: GatewayFrame) {
			if (frame.t === "READY") {
				const ready = yield* decodeData(Ready, frame.d);
				session.sessionId = ready.sessionId;
				session.resumeUrl = ready.resumeUrl;
			}
			if (frame.t !== undefined && frame.t !== null && frame.s !== undefined && frame.s !== null) {
				yield* dispatch({ data: frame.d, sequence: frame.s, type: frame.t });
			}
		});
		const handle = Effect.fnUntraced(function* (frame: GatewayFrame) {
			if (frame.s !== undefined && frame.s !== null) {
				session.sequence = frame.s;
			}
			switch (frame.op) {
				case 10:
					return yield* hello(frame.d);
				case 11:
					acknowledged = true;
					return;
				case 1:
					return yield* send(1, session.sequence);
				case 7:
					return yield* reconnect();
				case 9:
					if (frame.d !== true) {
						session.sessionId = undefined;
						session.resumeUrl = undefined;
						session.sequence = null;
					}
					return yield* reconnect();
				case 0:
					return yield* deliver(frame);
			}
		});
		const consume = Effect.gen(function* () {
			while (true) {
				for (const raw of yield* reader.pull) {
					yield* handle(yield* decodeFrame(raw));
				}
			}
		});
		return yield* Effect.raceFirst(consume, Deferred.await(failed));
	}).pipe(Effect.scoped);
}
