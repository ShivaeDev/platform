import { Deferred, Effect } from "effect";
import { RpcMessage, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { ConnectionReadiness } from "#connectionReadiness.ts";
import type { ResumeOptions } from "#resume.ts";
import { resumeSources } from "#resumeSources.ts";

export const resumeSocket = Effect.fnUntraced(function* (options: ResumeOptions) {
	const socket = yield* Socket.Socket;
	const connection = yield* ConnectionReadiness;
	const serialization = yield* RpcSerialization.RpcSerialization;
	const writer = yield* socket.writer;
	return Socket.make({
		reader: Effect.gen(function* () {
			const reader = yield* socket.reader;
			const scope = yield* Effect.scope;
			const context = yield* Effect.context();
			const parser = serialization.makeUnsafe();
			const failed = yield* Deferred.make<never, Socket.SocketError>();
			let pending: Deferred.Deferred<void> | undefined;
			const probe = Effect.suspend(() => {
				if (pending !== undefined) {
					return Effect.void;
				}
				const pong = Deferred.makeUnsafe<void>();
				pending = pong;
				return connection.close.pipe(
					Effect.andThen(
						Effect.suspend(() => {
							const ping = parser.encode(RpcMessage.constPing);
							return ping === undefined ? Effect.void : writer.write(ping);
						}),
					),
					Effect.andThen(Deferred.await(pong)),
					Effect.timeoutOrElse({
						duration: "2500 millis",
						orElse: () => Effect.fail(new Socket.SocketError({ reason: new Socket.SocketReadError({ cause: "Resume probe timed out" }) })),
					}),
					Effect.andThen(connection.open),
					Effect.catch((error) => Deferred.fail(failed, error)),
					Effect.ensuring(
						Effect.sync(() => {
							pending = undefined;
						}),
					),
				);
			});
			for (const source of resumeSources(options)) {
				yield* Effect.acquireRelease(
					Effect.sync(() =>
						source(() => {
							Effect.runForkWith(context)(Effect.forkIn(probe, scope));
						}),
					),
					(stop) => Effect.sync(stop),
				);
			}
			function observe(frames: ReadonlyArray<Uint8Array | string>) {
				for (const frame of frames) {
					const responses = parser.decode(frame);
					if (pending !== undefined && Array.isArray(responses) && responses.some((response) => response._tag === "Pong")) {
						Deferred.doneUnsafe(pending, Effect.void);
					}
				}
			}
			const pull = reader.pull.pipe(
				Effect.tap((frames) =>
					Effect.try({
						catch: (cause) => new Socket.SocketError({ reason: new Socket.SocketReadError({ cause }) }),
						try: () => observe(frames),
					}),
				),
				Effect.raceFirst(Deferred.await(failed)),
			);
			return { ...reader, pull };
		}),
		writer: Effect.succeed(writer),
	});
});
