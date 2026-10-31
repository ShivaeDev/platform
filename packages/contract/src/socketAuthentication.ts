import { Effect, Latch, Schema } from "effect";
import * as Socket from "effect/socket/Socket";

export const SocketAuthentication = Schema.Struct({
	_tag: Schema.Literal("Authenticate"),
	token: Schema.String,
});

export const authenticateSocket = Effect.fnUntraced(function* (token: string) {
	const socket = yield* Socket.Socket;
	const ready = yield* Latch.make(false);
	const writer = yield* Effect.map(socket.writer, (nativeWriter) => ({
		write: (chunk: Parameters<typeof nativeWriter.write>[0]) => ready.await.pipe(Effect.andThen(nativeWriter.write(chunk))),
		writeAll: (chunks: Parameters<typeof nativeWriter.writeAll>[0]) => ready.await.pipe(Effect.andThen(nativeWriter.writeAll(chunks))),
	}));
	return {
		...socket,
		reader: Effect.gen(function* () {
			yield* ready.close;
			const reader = yield* socket.reader;
			const raw = yield* socket.writer;
			yield* raw.write(JSON.stringify({ _tag: "Authenticate", token }));
			yield* ready.open;
			return { ...reader, pull: reader.pull.pipe(Effect.onError(() => ready.close)) };
		}),
		writer: Effect.succeed(writer),
	};
});
