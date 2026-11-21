import { Effect, Latch, Schema } from "effect";
import * as Socket from "effect/socket/Socket";

export const SocketAuthentication = Schema.Struct({
	_tag: Schema.Literal("Authenticate"),
	token: Schema.String.check(Schema.isPattern(/^[\x21-\x7e]+$/u)),
});

// Each connection reads the credential once, so a reconnect sends the one stored now and asks for a frame only when one follows.
export const authenticateSocket = Effect.fnUntraced(function* (
	url: string,
	credential: Effect.Effect<string | null>,
	headers?: Readonly<Record<string, string>>,
) {
	const framed = new URL(url);
	framed.searchParams.set("auth", "frame");
	let token: string | null = null;
	const socket = yield* Socket.makeWebSocket(
		Effect.map(credential, (current) => {
			token = current;
			return current === null ? url : framed.toString();
		}),
		{ headers },
	);
	const ready = yield* Latch.make(false);
	const writer = yield* Effect.map(socket.writer, (nativeWriter) => ({
		write: (chunk: Parameters<typeof nativeWriter.write>[0]) => ready.await.pipe(Effect.andThen(nativeWriter.write(chunk))),
		writeAll: (chunks: Parameters<typeof nativeWriter.writeAll>[0]) => ready.await.pipe(Effect.andThen(nativeWriter.writeAll(chunks))),
	}));
	return Socket.make({
		reader: Effect.gen(function* () {
			yield* ready.close;
			const reader = yield* socket.reader;
			if (token !== null) {
				const raw = yield* socket.writer;
				yield* raw.write(JSON.stringify({ _tag: "Authenticate", token }));
			}
			yield* ready.open;
			return { ...reader, pull: reader.pull.pipe(Effect.onError(() => ready.close)) };
		}),
		writer: Effect.succeed(writer),
	});
});
